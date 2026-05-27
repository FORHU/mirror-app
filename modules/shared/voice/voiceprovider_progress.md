# VoiceProvider — Architecture & Progress

## Overview

`VoiceProvider.tsx` is the central voice orchestration engine for the Smart Mirror frontend. It wraps the entire application and manages the full lifecycle of a voice interaction — from microphone input to audio playback.

---

## Current Architecture (v1 — Regex FSM)

### How it works today

```
[Mic] → [Transcribe] → [detectIntent() regex] → [dispatchAction()] → [TTS Playback]
                                ↓ (no match)
                         [mapService.ask() AI]
```

### Files

| File                  | Purpose                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------- |
| `VoiceProvider.tsx`   | Main provider — mic, FSM, audio playback                                                |
| `types.ts`            | Shared types: `VoiceState`, `Route`, `PendingAction`, `Confirmation`, `IntentStrength`  |
| `responses.ts`        | Central dictionary of voice responses per route (`ROUTE_RESPONSES`, `SYSTEM_RESPONSES`) |
| `useVoice.ts`         | Hook to consume voice context from child components                                     |
| `AiEventsOverlay.tsx` | UI overlay for displaying AI event cards                                                |

### Core Functions

| Function                               | What it does                                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `detectIntent(transcript, pathname)`   | Local regex engine — tries to match navigation commands, map controls, travel modes                      |
| `detectIntentStrength(text)`           | Classifies intent as `LOW / MEDIUM / HIGH` to decide if it should override a pending confirmation        |
| `isConfirmation(text)`                 | Classifies user reply as `CONFIRM / REJECT / UNCERTAIN`                                                  |
| `dispatchAction(action, forceExecute)` | Executes a `ChatWonderAction` — handles routing guards, confirmation gates, map actions, calendar events |
| `startListening()`                     | Opens mic, starts `ScriptProcessorNode` to capture PCM audio                                             |
| `stopListening()`                      | Stops mic, transcribes audio, runs the main processing pipeline                                          |
| `toggle()`                             | Unified button handler for idle → recording → stop                                                       |

### Voice Processing Pipeline

```
1. startListening()
   → getUserMedia()
   → ScriptProcessorNode captures Float32 PCM → converts to Int16

2. stopListening()
   → Combines Int16 chunks into single buffer
   → Builds rich context object (map state, calendar, location, time)
   → Transcribes via mapService.transcribe()

3. PRE-PROCESSOR (local FSM):
   → If pendingAction exists:
     - HIGH intent → override pending, fall through
     - CONFIRM → execute pending action with forceExecute=true
     - REJECT → clear pending, say "Cancelled"
     - UNCERTAIN → set ctx.mode = "confirm_context_required", fall through to AI

4. MAIN EXECUTION:
   → detectIntent() regex tries to match locally
   → If matched → dispatchAction() immediately (fast, no network)
   → If no match (type === "speak") → mapService.ask() sends to ChatWonder AI

5. dispatchAction():
   → Guard: check if on landing/select-gender page, block guarded routes
   → Confirmation gate: certain route switches require user confirmation
   → Execute: navigate, map control, calendar, traffic, etc.

6. Response:
   → setReply(r) — stores text for display
   → Play TTS audio via AudioContext
   → onended → setVoiceState("idle")
```

### Known Limitations

- **Two brains problem**: regex FSM and ChatWonder AI are separate. The AI only sees the conversation when regex fails to match.
- **Hardcoded responses**: voice replies for each route are hardcoded in `responses.ts`. AI cannot personalize them.
- **Hardcoded confirmation rules**: which routes need confirmation is baked into `dispatchAction()`.
- **Brittle regex patterns**: adding new commands requires editing large regex blocks manually.
- **No emotion/intent tracking**: the system doesn't know if the user is frustrated, urgent, or relaxed.

---

## Planned Architecture (v2 — Cognitive Orchestration)

### Vision

Replace the local regex FSM with a single AI-driven cognitive engine. The backend ChatWonder AI becomes the only brain. The frontend becomes a thin, fast executor.

```
[Mic] → [Transcribe] → [ChatWonder AI] → [Structured JSON Response]
                                                     ↓
                                        [Frontend Action Executor]
                                        - navigate
                                        - maps_navigate
                                        - calendar_*
                                        - traffic_*
                                        - speak (TTS only)
```

### New Response Shape (from backend)

```json
{
  "reply": "Sure, let's pull up the map.",
  "intent": {
    "primary": "navigate",
    "secondary": null,
    "confidence": 0.95
  },
  "emotion": "neutral",
  "action": {
    "type": "navigate",
    "payload": { "route": "/map" }
  },
  "followUpQuestion": null,
  "requiresConfirmation": false,
  "suggestions": [],
  "memoryUpdates": {},
  "uiHints": {
    "overlay": null,
    "focus": null
  }
}
```

### What stays on the frontend

The **confirmation loop** stays local for speed and statelessness:

```
pendingAction set by AI (requiresConfirmation: true)
  → User says "yes" → forceExecute pending action
  → User says "no" → clear pending, say "Cancelled"
  → User says high-intent command → override pending
```

### New Processing Pipeline

```
1. startListening() — unchanged
2. stopListening():
   → Transcribe
   → PRE-PROCESSOR (local, fast):
      - If pendingAction:
        - HIGH intent → override
        - CONFIRM → execute forceExecute
        - REJECT → cancel
   → mapService.ask(transcript, richContext)
   → Backend returns CognitiveResponse JSON
   → processCognitiveResponse():
      - If requiresConfirmation → store pendingAction
      - If action → dispatchAction(action.type, action.payload)
      - Play reply audio
3. Update history and state
```

### Changes Required

| File                 | Change                                                                                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`           | Add `CognitiveResponse`, `ActionPayload`, `UIHints`, `VoiceIntent`, `VoiceEmotion`. Remove `Confirmation`, `IntentStrength`, `PendingAction` (simplified). |
| `VoiceProvider.tsx`  | Remove `detectIntent()`, `detectIntentStrength()`, `isConfirmation()`, regex constants. Add `processCognitiveResponse()`. Simplify `dispatchAction()`.     |
| `responses.ts`       | Remove `ROUTE_RESPONSES`. Keep `SYSTEM_RESPONSES` for local edge cases (mic failure, cancel).                                                              |
| `mirror-api` backend | `mapService.ask()` response must return new `CognitiveResponse` JSON shape. System prompt must be updated.                                                 |

---

## Progress Tracker

- [x] Extract types to `types.ts`
- [x] Create `responses.ts` — central response dictionary
- [x] Import `ROUTE_RESPONSES` / `SYSTEM_RESPONSES` in `VoiceProvider.tsx`
- [x] Remove hardcoded strings from `dispatchAction()` and `detectIntent()`
- [x] Create `cognitive-voice.service.ts` with new orchestration prompt and parser
- [x] Define `CognitiveResponse` type in backend and frontend
- [x] Update `voice.controller.ts` to call the new cognitive service
- [x] Update frontend `map.service.ts` to expect and parse `CognitiveResponse`
- [x] Remove `detectIntent()` regex engine from `VoiceProvider.tsx`
- [x] Remove hardcoded confirmation guards from `dispatchAction()`
- [x] Refactor `stopListening()` to use the AI's `requiresConfirmation` flag
- [x] Build successfully compiles with all new types

---

## Conclusion

The refactor is complete. The system has converged on a **true production-grade orchestration pipeline** that separates AI reasoning, deterministic safety rules, and UI execution.

### The Final Orchestration Flow

```
1. Voice Input (Mic)
   ↓
2. Transcription (AWS Transcribe)
   ↓
3. 🧠 Cognitive Prompt Engine (SYSTEM + INTENT + ACTION RULES)
   ↓
4. ChatWonder AI (Single reasoning brain via cognitive-voice.service)
   ↓
5. CognitiveResponse Parser (Strict JSON validation)
   ↓
6. 🚨 ACTION GUARDIAN (Deterministic safety filter in VoiceProvider.tsx)
   ↓
7. Frontend Action Executor (Pure dispatch action mapper)
   ↓
8. UI / Maps / Navigation / Calendar
```

### Key Highlights

- **No Regex FSM**: The AI fully drives the intent and route logic.
- **Deterministic Action Firewall**: Replaced the simple `actionGuardian` with a flow-aware `guardAction`. It validates payloads (Schema Validation), enforces the Gender Lock, and strictly governs Flow Transitions based on the user's current location in the app.
- **FlowState Kernel**: The app's current context is now formally mapped to a `FlowState` (`AUTH`, `AI_FASHION`, `MAP`, etc.), serving as the single source of truth for the Action Firewall.
- **Pure Dispatcher**: `dispatchAction()` has been stripped of all business logic and routing guards. It blindly executes whatever passes through the Guardian.

### Next Steps: Separation of Concerns

Currently, `VoiceProvider.tsx` mixes three distinct responsibilities:

1. **Safety**: `guardAction` firewall logic.
2. **State Management**: `FlowState` tracking and `pendingAction` queuing.
3. **Execution**: `dispatchAction` routing and store updates.

The next evolutionary step is to extract these into discrete, testable modules (e.g. `flowState.ts`, `actionGuard.ts`, `actionExecutor.ts`) to make the core `VoiceProvider` significantly lighter and easier to debug.
