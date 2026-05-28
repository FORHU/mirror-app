# Voice — Pillars Implementation Plan

This plan turns the flat `voice/` module into the target structure and lands the two highest-ROI pillars (**observability** + **action schemas**) in a single day. Streaming, interruption, and memory are scoped as follow-up phases.

Execute in order. Each phase has a self-contained acceptance check before moving on.

---

## Day 1 — Reorganize + Observability + Schemas (~6 hours)

### Phase 1 — Reorganize `orchestration/` (30 min)

**Goal:** make the directory layout match what already exists in code. No behavior change.

**Moves:**

```
orchestration/kernel.ts            → orchestration/kernel/kernel.ts
orchestration/actionGuard.ts       → orchestration/guards/actionGuard.ts
orchestration/flowState.ts         → orchestration/guards/flowState.ts
orchestration/actionExecutor.ts    → orchestration/executor/actionExecutor.ts
orchestration/confirmationState.ts → orchestration/memory/confirmationState.ts
AiEventsOverlay.tsx                → overlays/AiEventsOverlay.tsx
VoiceProvider.tsx                  → providers/VoiceProvider.tsx
useVoice.ts                        → providers/useVoice.ts
```

Add barrel files so external imports don't need to know the nesting:

```
orchestration/index.ts    → re-exports kernel, guards, executor, memory
overlays/index.ts         → re-exports AiEventsOverlay
providers/index.ts        → re-exports VoiceProvider, useVoice
voice/index.ts            → re-exports providers (public API)
```

**Update imports:**
- Inside `VoiceProvider.tsx`: `./orchestration/kernel` → `../orchestration/kernel/kernel`, etc.
- Outside `voice/`: replace `@/modules/shared/voice/VoiceProvider` with `@/modules/shared/voice` (use the barrel).

**Acceptance:**
- `npm run build` passes.
- `npm run typecheck` passes.
- App launches, mic still records, voice still works end-to-end.

---

### Phase 2 — Telemetry foundation (2–3 hours)

**Goal:** every voice interaction emits a structured event stream you can inspect.

**New folder:**

```
telemetry/
├── types.ts          ← VoiceEvent discriminated union
├── emit.ts           ← emit(event) — fanout to sinks
├── sinks/
│   ├── console.ts    ← dev sink, pretty prints
│   └── buffer.ts     ← in-memory ring buffer (last 200 events) for debugging
└── index.ts
```

**`telemetry/types.ts` sketch:**

```ts
export type VoiceEvent =
  | { type: "voice.session.start"; ts: number; sessionId?: string }
  | { type: "voice.mic.open"; ts: number }
  | { type: "voice.mic.close"; ts: number; durationMs: number; bytes: number }
  | { type: "voice.transcribe.start"; ts: number }
  | { type: "voice.transcribe.end"; ts: number; latencyMs: number; transcript: string; language: string }
  | { type: "voice.ask.start"; ts: number; transcript: string; ctxKeys: string[] }
  | { type: "voice.ask.end"; ts: number; latencyMs: number; actionType: string | null; requiresConfirmation: boolean }
  | { type: "voice.guard.result"; ts: number; allowed: boolean; reason?: string; redirected?: string }
  | { type: "voice.action.execute"; ts: number; actionType: string }
  | { type: "voice.confirmation.pending"; ts: number; actionType: string }
  | { type: "voice.confirmation.resolved"; ts: number; outcome: "yes" | "no" | "expired" | "override" }
  | { type: "voice.tts.start"; ts: number; chars: number }
  | { type: "voice.tts.end"; ts: number; latencyMs: number }
  | { type: "voice.error"; ts: number; phase: string; message: string };
```

**`telemetry/emit.ts` sketch:**

```ts
import { consoleSink } from "./sinks/console";
import { bufferSink } from "./sinks/buffer";
import type { VoiceEvent } from "./types";

const sinks = [consoleSink, bufferSink];

export function emit(event: VoiceEvent) {
  for (const sink of sinks) sink(event);
}

export { getBufferedEvents } from "./sinks/buffer";
```

**Instrument `VoiceProvider.tsx`:**
- `startListening` → emit `mic.open`
- `stopListening` start → emit `mic.close` with duration + bytes
- Before `mapService.transcribe` → `transcribe.start`; after → `transcribe.end` with `Date.now() - start`
- Before `mapService.ask` → `ask.start`; after → `ask.end` (include `actionType`, `requiresConfirmation`)
- After `guardAction` in kernel → `guard.result` (refactor: have `runKernel` return guard outcome explicitly or have the kernel emit it itself)
- Before `executeAction` → `action.execute`
- When entering `PENDING` → `confirmation.pending`
- When resolving (yes/no/expired/override) → `confirmation.resolved`
- Before TTS playback → `tts.start`; on `src.onended` → `tts.end`
- Any `catch` block → `voice.error` with the phase name

**Dev surface (optional, 30 min stretch):**
Add a hidden `?debug=voice` query param that mounts a `<VoiceTelemetryPanel />` overlay showing the last N events from the buffer sink. Stick it next to `AiEventsOverlay`.

**Acceptance:**
- Run one voice turn end-to-end. Console shows 10–12 events with monotonic `ts` and sensible latencies.
- `getBufferedEvents()` from devtools returns the same events.
- No event has `latencyMs > 30000` (sanity floor).

---

### Phase 3 — Action schemas with Zod (2–3 hours)

**Goal:** the cognitive response is validated at the boundary. Bad payloads fail loudly before reaching the executor.

**Install:** `npm i zod` (check it isn't already a dep first).

**New folder:**

```
cognition/
├── schemas/
│   ├── action.ts        ← Zod schemas for every ChatWonderAction variant
│   ├── response.ts      ← Zod schema for the full CognitiveResponse
│   └── index.ts
├── parsers/
│   ├── parseResponse.ts ← validates + returns Result<CognitiveResponse, ParseError>
│   └── index.ts
└── index.ts
```

**`cognition/schemas/action.ts` sketch:**

```ts
import { z } from "zod";

export const NavigateAction = z.object({
  type: z.literal("navigate"),
  route: z.string().min(1),
  suggestion: z.string().optional(),
});

export const MapsNavigateAction = z.object({
  type: z.literal("maps_navigate"),
  destination: z.string().min(1),
});

export const MapsPreviewAction = z.object({
  type: z.literal("maps_preview_location"),
  query: z.string().min(1),
  label: z.string(),
});

// ...one schema per variant in chatwonder.types.ts ChatWonderAction union

export const ChatWonderActionSchema = z.discriminatedUnion("type", [
  NavigateAction,
  MapsNavigateAction,
  MapsPreviewAction,
  // ... all variants
]);

export type ChatWonderAction = z.infer<typeof ChatWonderActionSchema>;
```

**Migration note:** delete the hand-written `ChatWonderAction` union in `chatwonder.types.ts` and re-export the inferred type from `cognition/schemas/action.ts`. Keeps one source of truth.

**`cognition/schemas/response.ts` sketch:**

```ts
import { z } from "zod";
import { ChatWonderActionSchema } from "./action";

export const CognitiveResponseSchema = z.object({
  reply: z.string(),
  action: ChatWonderActionSchema.nullable(),
  events: z.array(z.unknown()).optional(),
  audio: z.instanceof(ArrayBuffer).optional(),
  sessionId: z.string().optional(),
  requiresConfirmation: z.boolean().optional(),
});

export type CognitiveResponse = z.infer<typeof CognitiveResponseSchema>;
```

**`cognition/parsers/parseResponse.ts` sketch:**

```ts
import { CognitiveResponseSchema, type CognitiveResponse } from "../schemas/response";
import { emit } from "../../telemetry/emit";

export type ParseResult =
  | { ok: true; data: CognitiveResponse }
  | { ok: false; error: string; raw: unknown };

export function parseCognitiveResponse(raw: unknown): ParseResult {
  const result = CognitiveResponseSchema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  emit({
    type: "voice.error",
    ts: Date.now(),
    phase: "parse",
    message: result.error.message,
  });
  return { ok: false, error: result.error.message, raw };
}
```

**Wire it in:**
- In `VoiceProvider.tsx`, after `await mapService.ask(...)`, run `parseCognitiveResponse(res)` and branch on `ok`.
- On parse failure: speak `SYSTEM_RESPONSES.cancelled` (or a new "I didn't understand that" response), do not execute, emit `voice.error`.

**Update `actionGuard.ts`:**
- Drop the ad-hoc `if (!action.type)` and `if (!action.route)` checks — the schema already guarantees them.
- Keep the business rules (gender gate, flow transitions).

**Acceptance:**
- Force a malformed action in `mocks/chatwonder-results.json` (e.g. `{type: "navigate"}` with no `route`). Voice turn does NOT crash, falls back to a polite reply, telemetry shows `voice.error{phase:"parse"}`.
- All happy-path actions still execute as before.
- Build + typecheck clean.

---

## Day 1 Final Acceptance

- [ ] Folder structure matches plan above
- [ ] All existing voice features still work (record → transcribe → ask → guard → execute → speak → idle)
- [ ] Console shows structured telemetry for every turn
- [ ] Malformed cognitive responses fail safely with a logged parse error
- [ ] `npm run build` and `npm run typecheck` pass

---

## Phase 4 — Streaming (follow-up, ~2 days)

**Backend prerequisite** (block Phase 4 until done):
- Convert `POST /api/mirror/voice/ask` to SSE or WebSocket
- Stream tokens of `reply` as they're generated; stream `action` once decided; stream `audio` chunks last (or in parallel via a separate channel)

**Frontend:**
- New folder `audio/streaming/` with `streamReply.ts` (consumes SSE/WS, emits `chunk` events)
- TTS: switch from "wait for full buffer" to "decode + play first chunk as soon as available" via `MediaSource` API or chunked `AudioBufferSource` queue
- Telemetry: add `voice.stream.first_token`, `voice.stream.first_audio`, `voice.stream.complete`
- Acceptance: time-to-first-audio < 800ms on a warm connection (vs current ~3–5s)

---

## Phase 5 — Interruption (follow-up, ~1 day after streaming)

**Depends on:** Phase 4 (streaming), and adding VAD.

**New folder:** `audio/vad/`
- Use [`@ricky0123/vad-web`](https://github.com/ricky0123/vad) or similar
- Run continuously when `voiceState === "speaking"`; on speech detection → `stopPlayback()` + `startListening()`

**AbortController everywhere:**
- `mapService.transcribe`, `mapService.ask`, `mapService.tts` all accept an `AbortSignal`
- Route change + user tap during `processing` aborts the in-flight request
- Telemetry: `voice.aborted{phase}`

**State machine updates:**
- New transition: `speaking + speech_detected → recording` (barge-in)
- New transition: `processing + tap → idle` (cancel)

---

## Phase 6 — Memory (follow-up, ~2 days, needs backend)

**Backend:**
- Add `memoryUpdates` field to `CognitiveResponse` (the v2 doc already specced it)
- Persist per-user preferences (preferred travel mode, frequent destinations, dietary prefs) in a new `user_voice_memory` table
- Cognitive prompt includes memory snapshot in the context

**Frontend:**
- New folder `orchestration/memory/` already exists for confirmation — add `userMemory.ts` for the long-term memory cache
- Hydrate from `/api/mirror/voice/memory` on auth
- Apply `memoryUpdates` from each response, sync to backend

---

## Phase 7 — Cognition extras (optional, not blocking)

- `cognition/prompts/` — extract the system prompt from `cognitive-voice.service` into versioned `.md` files (frontend-side mirror for parity testing)
- `cognition/emotion/` — only if backend starts returning `emotion` in CognitiveResponse; otherwise skip
- `cognition/reasoning/` — placeholder; revisit when there's actual local reasoning to do (probably never — keep on backend)

---

## Ordering rationale

1. **Reorganize first** — cheap, makes every subsequent diff clearer.
2. **Observability before everything else** — you cannot tune what you cannot measure, and every later phase will need it.
3. **Schemas next** — small effort, big safety win, blocks a class of bugs forever.
4. **Streaming** — biggest perceived-quality win for the user.
5. **Interruption** — naturally follows streaming (you need partial state to interrupt).
6. **Memory** — highest ceiling but only useful once the rest is stable.
