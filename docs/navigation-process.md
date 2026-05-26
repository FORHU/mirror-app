# Mirror App — Navigation & Voice Architecture

> **Last Updated:** May 2026 — Reflects current production architecture including Zustand state management, 4-layer AI intent system, strict routing guard, and auto-suggestion pipeline.

This document outlines how navigation is handled within the `mirror-app` Next.js frontend, covering touch navigation, voice-driven routing, intent detection, AI response dispatching, and state management.

---

## 1. Screen Routes

All routes are strictly typed in `navigation.ts` to prevent broken links:

```typescript
export const ROUTES = {
  WELCOME: "/",
  SELECT_GENDER: "/select-gender",
  LOGGED_IN: "/authentication",
  OVERVIEW: "/overview",
  AI_RECOMMENDATION_FASHION: "/ai-recommendation-fashion",
  AI_RECOMMENDATION_COSMETIC: "/ai-recommendation-cosmetic",
  AI_RECOMMENDATION_COSMETIC_RESULT: "/ai-recommendation-cosmetic/result",
  MAP: "/map",
  VIRTUAL_MIRROR: "/virtual-mirror",
} as const;
```

### Screen Descriptions

| Route                         | Screen                | Trigger                          |
| ----------------------------- | --------------------- | -------------------------------- |
| `/`                           | Home / Welcome        | Default idle state               |
| `/select-gender`              | Gender Selection      | Voice: "Start now" / "Commencer" |
| `/authentication`             | QR Code Auth          | AI navigation or direct tap      |
| `/ai-recommendation-fashion`  | Fashion + Outfit Grid | Voice intent FASHION or tap      |
| `/ai-recommendation-cosmetic` | Skin Analysis Camera  | Voice intent COSMETIC or tap     |
| `/map`                        | Wayfinding Map        | Voice intent MAP or tap          |
| `/overview`                   | Logged-in Home        | Voice: "home" / post-auth        |
| `/virtual-mirror`             | Virtual Try-On        | Voice: "try it on"               |

---

## 2. Voice System Architecture (`VoiceProvider.tsx`)

The `VoiceProvider` is a global React Context wrapping the entire app (in `layout.tsx`). It manages the complete voice state machine and all action dispatching.

### Voice State Machine

```
idle → recording → processing → speaking → idle
```

| State        | Meaning                                                     |
| ------------ | ----------------------------------------------------------- |
| `idle`       | Waiting. Microphone inactive                                |
| `recording`  | Microphone active, collecting PCM audio chunks              |
| `processing` | Audio sent to backend, awaiting transcription + AI response |
| `speaking`   | AI audio response playing through browser                   |

### Context Values Exposed to All Screens

```typescript
{
  voiceState,        // current state machine state
  transcript,        // last recognized user speech
  reply,             // last AI text reply
  error,             // current error message or null
  isListening,       // boolean: recording state
  isProcessing,      // boolean: processing state
  isSpeaking,        // boolean: speaking state
  toggle,            // start/stop/interrupt toggle
  startListening,    // begin microphone capture
  stopListening,     // stop capture + process audio
  registerPage,      // called by pages to receive page-specific actions
  unregisterPage,    // cleanup when page unmounts
  aiEvents,          // itinerary event objects from AI response
}
```

---

## 3. The Voice Pipeline (Step-by-Step)

### Phase 1 — Audio Capture

1. User taps microphone → `startListening()` is called
2. `navigator.mediaDevices.getUserMedia({ audio: true })` activates microphone
3. `AudioContext` is created at **16,000 Hz** (required by AWS Transcribe)
4. `ScriptProcessorNode` processes audio in **4,096-sample chunks**
5. Each chunk is converted `Float32 → Int16` and pushed to `chunksRef` (in-memory array)
6. `voiceState` → `"recording"`

### Phase 2 — Sending Audio

7. User taps microphone again → `stopListening()` is called
8. All `Int16Array` chunks are concatenated into a single buffer
9. Microphone and audio nodes are cleaned up
10. A **full context snapshot** is assembled from live state:
    - `userLocation` / `homeLocation` from `useMapStore`
    - Next 3 upcoming events from `useCalendarStore`
    - Navigation status, route, ETA from `useMapStore`
    - Current time and date
    - Current page name
    - ChatWonder session ID from `sessionIdRef`
    - User outline ID from `useOutlineStore`
11. `mapService.transcribe(combined.buffer)` → `POST /api/mirror/voice/transcribe`
12. `voiceState` → `"processing"`

### Phase 3 — Intent Detection (Regex Fast-Path)

13. Transcript arrives. `detectIntent(transcript, pathname)` runs immediately.
14. Checks regex rules in priority order:

**Priority 0 — Page-specific:**

- On `/select-gender`: "male" / "female" / "homme" / "femme" → `{ type: "select_gender", gender: "MALE" }`
- On `/` or `/welcome`: "start now" / "begin" / "commencer" → `{ type: "navigate", route: "/select-gender" }`

**Priority 1 — Screen navigation:**

- "open map" / "navigation" / "carte" → `{ type: "navigate", route: "/map" }`
- "build outfit" / "style my fashion" / "pick clothes" → `{ type: "navigate", route: "/ai-recommendation-fashion" }`
- "do my makeup" / "open cosmetics" / "skin care" → `{ type: "navigate", route: "/ai-recommendation-cosmetic" }`
- "try it on" / "virtual fitting" → `{ type: "navigate", route: "/virtual-mirror" }`
- "home" / "main screen" / "accueil" → `{ type: "navigate", route: "/overview" }`

**Priority 2 — Travel mode:**

- "switch to walking" / "set mode to car" → `{ type: "set_profile", profile: "..." }`

**Priority 3 — Map controls:**

- "turn on traffic" → `{ type: "traffic_on" }`
- "best route" / "avoid traffic" → `{ type: "traffic_route" }`
- "stop navigation" → `{ type: "stop_navigation" }`

**Priority 4 — Physical navigation:**

- "take me to Starbucks" / "navigate to Nike" → `{ type: "maps_navigate", destination: "..." }`

**Default:**

- No match → `{ type: "speak" }` — escalate to AI

### Phase 4a — Fast Path (Regex Matched)

15. If `action.type !== "speak"`:
    - Calls `POST /api/mirror/voice/tts` to get acknowledgment audio ("Opening that up.")
    - Calls `dispatchAction(action)` immediately — screen changes without waiting for AI
    - `voiceState` → `"speaking"` → plays audio → `"idle"`

### Phase 5a — AI Path (No Regex Match)

16. If `action.type === "speak"`:
    - Calls `mapService.ask(transcript, ctx, history)` → `POST /api/mirror/voice/ask`
    - Backend assembles 4-layer prompt, fetches weather, calls ChatWonder AI, generates TTS
    - Response returns: MP3 audio buffer + `X-Reply` + `X-Action` + `X-Session-Id` + `X-Events`
    - Frontend parses headers → gets `reply` text, `action` object, `sessionId`, `events`
    - Saves new `sessionId` to `sessionIdRef` for conversation continuity

### Phase 6 — Action Dispatch

17. `dispatchAction(action)` processes the received action:

**`type === "navigate"` (AI-routed screen change):**

```
1. Check action.suggestion
   → If present: useMirrorStore.setAiSuggestion(suggestion)
   → If absent:  useMirrorStore.clearAiSuggestion()

2. Route guard fallback:
   Safe routes = ["/ai-recommendation-fashion", "/ai-recommendation-cosmetic",
                  "/map", "/select-gender", "/authentication"]
   → If action.route not in safe list → force "/ai-recommendation-fashion"

3. router.push(validatedRoute)
```

**`type === "maps_navigate"` (physical navigation):**

```
→ If already on /map: geocode destination → fetch route → start navigation
→ If on other screen: sessionStorage.setItem("mirror_pending_map_directions", ...) → router.push("/map")
   (Map screen reads sessionStorage on mount and begins routing automatically)
```

**`type === "traffic_on/off/route"`, `"set_profile"`, `"stop_navigation"`:**

```
→ Directly update useMapStore Zustand state
```

**`type === "calendar_save_event"`:**

```
→ useCalendarStore.getState().addEvent(...)
```

**`type === "select_gender"`:**

```
→ Forwarded to page-specific handler via onActionRef
```

### Phase 7 — Audio Playback

18. MP3 audio buffer is decoded via Web Audio API
19. `AudioBufferSourceNode` plays the audio
20. `voiceState` → `"speaking"`
21. When `src.onended` fires → `voiceState` → `"idle"`
22. Conversation history updated: `[...historyRef, { user: transcript, assistant: reply }].slice(-4)`

---

## 4. AI Suggestion State (Zustand)

The AI's recommendation text is managed in `useMirrorStore` — a dedicated Zustand store:

```typescript
interface MirrorState {
  aiSuggestion: string | null;
  setAiSuggestion: (suggestion: string | null) => void;
  clearAiSuggestion: () => void;
}
```

**Flow when arriving via voice:**

1. AI returns `action.suggestion` (e.g., "A white linen shirt for this 28°C day")
2. `dispatchAction` calls `useMirrorStore.setAiSuggestion(suggestion)` before navigating
3. Target screen reads `useMirrorStore(state => state.aiSuggestion)` on mount
4. Displays "✨ AI Suggestion" glass-card banner immediately

**Flow when arriving via UI tap (no voice):**

1. Screen mounts, checks `useMirrorStore.aiSuggestion` → null
2. Silently calls `POST /api/mirror/voice/suggest` with current GPS location
3. Backend generates a weather-based suggestion without TTS
4. `useMirrorStore.setAiSuggestion(suggestion)` → banner fades in

---

## 5. Fashion Screen — Data Loading (`/ai-recommendation-fashion`)

On mount, the screen fetches all garment slots in parallel:

```typescript
Promise.allSettled([
  garmentService.getBySlot(FittingSlot.UpperGarment), // Tops
  garmentService.getBySlot(FittingSlot.LowerGarment), // Bottoms
  garmentService.getBySlot(FittingSlot.FootGarment), // Shoes
  garmentService.getBySlot(FittingSlot.HeadGarment), // Hats/Caps
  garmentService.getBySlotAndType(FittingSlot.RightHandAccessory, "Bag"), // Bags
]);

outfitService.getAll(); // Pre-built outfit collections
```

Garments are paginated with swipe navigation. Outfits are displayed in a 2-column grid. Selecting an outfit clears individual slot selections, and selecting individual slots clears the selected outfit.

---

## 6. Cosmetics Screen — FaceMesh Pipeline (`/ai-recommendation-cosmetic`)

1. MediaPipe `FaceMesh` loaded from CDN
2. Camera activates via `window.Camera`
3. FaceMesh processes every frame, tracking 6 key landmarks: `[4, 152, 10, 234, 454, 1]` (nose-tip, chin, forehead, jaw L/R, nose bridge)
4. Each landmark is transformed from MediaPipe normalized coords (0-1) to actual display pixels, accounting for the `object-cover` CSS scale and the `scaleX(-1)` mirror flip
5. All 6 landmarks must fall within the oval guide (`rx=330, ry=410`) for **20+ consecutive frames**
6. Once threshold met → **1.5 second hold timer** begins (emerald pulse animation)
7. Timer fires → `captureFrame()`:
   - Canvas renders current video frame
   - Converts to JPEG base64
   - Uploads to S3 via `/api/mirror/file-uploads/upload`
   - Sends `fileId` to `/api/mirror/skin-analyses`
   - Backend returns: `skinType`, `skinTone`, `hydrationPct`, `oilinessPct`, `concerns`, `routineTip`, ranked `SkinRecommendation[]`
8. Result stored to `sessionStorage.skin_analysis`
9. Navigates to `/ai-recommendation-cosmetic/result`

---

## 7. Map Navigation Handoffs

State is passed between screens via `sessionStorage` for map-related interactions:

| Key                             | Set By          | Read By             | Purpose                    |
| ------------------------------- | --------------- | ------------------- | -------------------------- |
| `mirror_pending_map_directions` | `VoiceProvider` | Map screen on mount | Destination to navigate to |
| `mirror_pending_map_location`   | `VoiceProvider` | Map screen on mount | Location to preview on map |

These are used when a user triggers map navigation from a non-map screen. The map screen checks these keys on mount and immediately starts the appropriate action.

---

## 8. Zustand Store Reference

| Store              | File                               | Owns                                     |
| ------------------ | ---------------------------------- | ---------------------------------------- |
| `useMirrorStore`   | `store/useMirrorStore.ts`          | `aiSuggestion` — AI recommendation text  |
| `useMapStore`      | `modules/map/store/useMapStore.ts` | GPS, route, navigation, traffic, profile |
| `useCalendarStore` | `store/useCalendarStore.ts`        | Upcoming events list                     |
| `useOutlineStore`  | `store/useOutlineStore.ts`         | Event planning outline ID                |
| `useAuthStore`     | `store/useAuthStore.ts`            | JWT token, user profile, home location   |
