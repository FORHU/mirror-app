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
- [x] Extract `flowState.ts`, `actionGuard.ts`, `actionExecutor.ts` into `orchestration/`
- [x] Introduce `kernel.ts` to compose guard → execute as a single entry point
- [x] Extract `confirmationState.ts` with explicit `IDLE / PENDING` state + 30s TTL
- [x] Honor server-driven `requiresConfirmation` from the cognitive response
- [x] Persist chat-wonder `sessionId` across reloads via `sessionStorage` (cleared at `/`)

---

## Conclusion

The refactor is complete. The system has converged on a **true production-grade orchestration pipeline** that separates AI reasoning, deterministic safety rules, and UI execution. The "next steps" separation-of-concerns work has been finished — `VoiceProvider.tsx` is now a thin I/O shell and all orchestration lives in [`orchestration/`](./orchestration/).

### Current Module Layout

| File                              | Responsibility                                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `VoiceProvider.tsx`               | Mic capture, PCM encode, transcript/TTS playback, voice state machine, pre-processor (yes/no regex)         |
| `orchestration/kernel.ts`         | `runKernel(action, pathname, router, onAction)` — composes guard → execute                                  |
| `orchestration/actionGuard.ts`    | `guardAction()` — gender gate, AI_FASHION/AI_COSMETIC → `/map` confirmation gate, payload validation        |
| `orchestration/actionExecutor.ts` | Pure dispatch — `navigate`, `maps_*`, `traffic_*`, `set_profile`, `calendar_*`, `maps_suggest_places`       |
| `orchestration/flowState.ts`      | `getFlowState(pathname)` → `IDLE / NEEDS_GENDER / AI_FASHION / AI_COSMETIC / MAP / LOCKED`                  |
| `orchestration/confirmationState.ts` | `ConfirmationState` discriminated union (`IDLE` / `PENDING`) with 30s expiry + helpers                   |
| `types.ts`                        | `VoiceState` and shared types                                                                               |
| `responses.ts`                    | `ROUTE_RESPONSES` (per-flow intercept copy) + `SYSTEM_RESPONSES` (cancel, gender guard, default open)       |
| `AiEventsOverlay.tsx`             | UI overlay for AI event cards emitted alongside the reply                                                   |
| `useVoice.ts`                     | Hook for consumers                                                                                          |

### The Final Orchestration Flow

```
1. Voice Input (Mic, ScriptProcessorNode → Int16 PCM @ 16kHz)
   ↓
2. Transcription (mapService.transcribe → /api/mirror/voice/transcribe)
   ↓
3. 🛡  Pre-processor — Local Confirmation FSM (VoiceProvider.tsx)
      • If ConfirmationState === PENDING and not expired:
          - HIGH-intent override → clear pending, fall through
          - YES → re-run guardAction on stored action, execute, speak default
          - NO  → clear pending, speak SYSTEM_RESPONSES.cancelled
          - UNCERTAIN → ctx.mode = "confirm_context_required", fall through
   ↓
4. 🧠 Cognitive Prompt Engine (SYSTEM + INTENT + ACTION RULES)
   ↓
5. ChatWonder AI (cognitive-voice.service via mapService.ask)
   ↓
6. CognitiveResponse Parser (strict JSON: reply, action, requiresConfirmation, events, sessionId, audio)
   ↓
7. 🚦 Server-driven confirmation check
      • If res.requiresConfirmation → store as PENDING, DO NOT execute (TTS already asks)
      • Else → runKernel(action, pathname, router, onAction)
   ↓
8. 🚨 ACTION GUARDIAN (orchestration/actionGuard.ts)
      • Schema validation (type, route presence)
      • Gender gate (fashion/cosmetic → redirect to /select-gender)
      • Flow transition gate (AI_FASHION|AI_COSMETIC → /map requires confirmation)
   ↓
9. Frontend Action Executor (orchestration/actionExecutor.ts — pure dispatch)
   ↓
10. UI / Maps / Navigation / Calendar / TTS playback → state returns to idle
```

### Key Highlights

- **No Regex FSM for intent**: ChatWonder fully drives intent and route logic. The only regex left is the local pre-processor for yes/no/high-intent overrides during a pending confirmation — kept local for latency and to survive transient network failures.
- **Two-tier confirmation**:
  1. **Server-driven** — cognitive response sets `requiresConfirmation: true` and writes the TTS prompt itself.
  2. **Client-driven** — `guardAction` can also gate a transition (e.g. AI_FASHION → /map) using `ROUTE_RESPONSES[*].intercept`.
  Both paths store a `PENDING` `ConfirmationState` with a 30s TTL; the pre-processor resolves it on the next utterance.
- **Deterministic Action Firewall**: `guardAction` is flow-aware, validates payloads, enforces the Gender Lock, and governs Flow Transitions based on the user's current `FlowState`.
- **FlowState Kernel**: Pathname → `FlowState` is the single source of truth for the Action Firewall.
- **Pure Dispatcher**: `executeAction` has no business logic or routing guards — it blindly executes whatever passed the Guardian, and falls back to the page-registered `onAction` for page-local events.
- **Session continuity**: `sessionId` from the cognitive response is mirrored into `sessionStorage` so chat-wonder context survives page reloads on non-Attract routes, and is cleared on arrival at `/`.
