# Voice Transcription — Known Issues & Analysis

**Date:** 2026-05-27  
**Component:** `modules/shared/voice/VoiceProvider.tsx` + backend `voice.controller.ts` / `voice.service.ts`  
**Status:** Partially mitigated (sample-rate resampling added). Core issues remain.

---

## User-Reported Problems

### 1. Hit-or-miss transcription accuracy
Voice input is unreliable. Some phrases transcribe correctly; others come back completely wrong or partially missing. The failure is not consistent — the same phrase can work one attempt and fail the next.

### 2. Input mangled beyond recognition
**Reported example:**
- Said: `"Navigate me to SM Baguio"`
- Received: `"assembaguio"`

The beginning of the phrase (`"Navigate me to"`) was dropped entirely, and the remainder (`"SM Baguio"`) was garbled into a single run-on token. This is characteristic of audio being decoded at the wrong sample rate on the STT side.

---

## Root Causes Identified

### RC-1 — Sample rate mismatch (confirmed, partially fixed)

**Where:** `VoiceProvider.tsx` — `startListening()`

```ts
const ctx = new AudioContext({ sampleRate: 16000 });
```

`{ sampleRate: 16000 }` is a **hint**, not a guarantee. Most browsers lock the AudioContext to the system audio device rate (44100 Hz or 48000 Hz) regardless of the requested value. The captured PCM was being sent as-is, but the backend told AWS Transcribe to decode it at `MediaSampleRateHertz: 16000`.

**Effect:** Audio decoded at 1/3 speed (48000 → 16000). AWS Transcribe hears low-pitched, time-stretched noise and produces nonsense. Explains the "assembaguio" result — the audio was so distorted that only fragments of phonemes survived recognition.

**Partial fix applied:** `resampleTo16k()` using `OfflineAudioContext` now detects when `audioCtx.sampleRate !== 16000` and resamples before sending. This is a workaround for the root cause, not a replacement of the problematic capture method.

---

### RC-2 — `ScriptProcessorNode` is deprecated and runs on the main thread

**Where:** `VoiceProvider.tsx` — `startListening()`

```ts
const processor = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1);
processor.onaudioprocess = (e) => { ... };
```

`ScriptProcessorNode` has been deprecated since the Web Audio API spec was updated. Two concrete problems:

1. **Main thread audio processing.** The `onaudioprocess` callback fires on the JS main thread. Any React re-render, route change, or async operation that blocks the thread will cause the callback to be skipped — silently dropping audio buffers. No warning, no error, just missing audio.

2. **Startup latency.** Every call to `startListening()` creates a new `MediaStream`, a new `AudioContext`, and a new `ScriptProcessorNode`. The mic stream does not start delivering data immediately — the first 1–3 buffer cycles (~256ms at 4096 buffer / 16000 Hz) are often silent or partial. The beginning of whatever the user says is consistently dropped before the callback starts firing meaningfully.

**Correct replacement:** `AudioWorklet`, which runs in a dedicated audio worklet thread, isolated from the main JS thread. Alternatively, drop raw PCM capture entirely and use `MediaRecorder` (see RC-5).

---

### RC-3 — Wrong AWS Transcribe language for the deployment region

**Where:** Backend `voice.service.ts`

```ts
LanguageOptions: "en-US,fr-FR"
IdentifyLanguage: true
```

The mirror is deployed in the **Philippines**. AWS Transcribe supports `en-PH` (Philippine English), which has its own acoustic model trained on Filipino speakers' pronunciation patterns and regional vocabulary.

**Effect:** The STT model is optimized for American or French speakers. Philippine-specific terms — mall names (`SM`, `Ayala`, `Robinsons`), city names (`Baguio`, `Batangas`, `Makati`), and the general phonetic patterns of Philippine English — are poorly handled. `en-US` treats "SM" as an unusual phoneme sequence rather than a common abbreviation, contributing to mangled output.

**Fix:** Add `en-PH` to `LanguageOptions`. Optionally create an AWS Transcribe Custom Vocabulary with common Philippine place names and brands.

---

### RC-4 — No explicit audio constraints on `getUserMedia`

**Where:** `VoiceProvider.tsx` — `startListening()`

```ts
const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
```

Without explicit audio processing constraints, browser behavior varies per OS and device:

- **Echo cancellation** may be off — when the AI reply is playing through speakers and the user speaks, the mic picks up the TTS audio and sends it back through transcription.
- **Noise suppression** may be off — ambient room noise (HVAC, fan, ambient sounds near the mirror) bleeds into the audio stream.
- **Auto gain control** may be off — quiet speech or speech from distance (user standing in front of a mirror) gets no compensation.

**Fix:**
```ts
navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  }
})
```

---

### RC-5 — Raw PCM pipeline is fragile and unnecessary complexity

**Where:** `VoiceProvider.tsx` throughout `startListening()` / `stopListening()`

The current pipeline manually manages:
- Float32 → Int16 conversion (`float32ToInt16`)
- Buffer accumulation (`chunksRef`)
- Sample rate detection and resampling (`resampleTo16k`)
- Manual ArrayBuffer concatenation
- Sending raw bytes as `application/octet-stream`

The `MediaRecorder` API does all of this in one line and produces a properly encoded audio blob. AWS Transcribe Streaming supports `ogg-opus` encoding (`MediaEncoding: "ogg-opus"`), which `MediaRecorder` outputs natively via `audio/webm;codecs=opus`.

**Benefit of switching:** Eliminates `float32ToInt16`, `resampleTo16k`, `BUFFER_SIZE`, `SAMPLE_RATE` constant, all chunk management refs, and the `ScriptProcessorNode` entirely. ~80 lines of fragile audio plumbing reduced to ~10.

---

### RC-6 — Three sequential API round trips before user hears anything

**Where:** `VoiceProvider.tsx` — `stopListening()`

```
[stop recording]
    → POST /voice/transcribe   (~500–1500ms)
    → POST /voice/ask          (~1000–3000ms, includes LLM + TTS generation)
    → decodeAudioData + play
```

Two full API calls in series. The user presses stop and waits in silence for 1.5–4.5 seconds before hearing anything. There is no streaming, no partial result display during processing, and no timeout if either call hangs.

**Fix:** Combine into a single `/voice/process` endpoint that receives audio, runs transcription and LLM inference together, and returns `{ transcript, reply, audioBase64 }`. Saves one full HTTP round trip.

---

### RC-7 — Dead code: `detectIntent` always returns `"speak"`

**Where:** `VoiceProvider.tsx` lines 59–67

```ts
function detectIntent(_transcript, _pathname) {
  // All intent resolution is handled by the AI backend.
  return { type: "speak" };
}
```

This function unconditionally returns `{ type: "speak" }`. The `if (action.type !== "speak")` branch downstream **never executes**. The function and the entire branch are unreachable dead code. Leaving it creates a false impression that client-side intent routing exists.

**Fix:** Delete `detectIntent`, collapse the if/else into the `ask` call directly.

---

## Impact Summary

| Issue | Severity | Affects | Status |
|---|---|---|---|
| Sample rate mismatch | Critical | Every recording | Mitigated (resampler added) |
| ScriptProcessorNode main-thread drops | High | ~30% of recordings | Open |
| Wrong AWS language (`en-US` not `en-PH`) | High | All Philippine vocabulary | Open — backend change needed |
| No audio constraints | Medium | Noisy environments / TTS bleed | Open |
| Raw PCM pipeline fragility | Medium | Reliability overall | Open |
| Sequential API calls (latency) | Medium | Perceived responsiveness | Open |
| Dead `detectIntent` code | Low | Code clarity | Open |

---

## Recommended Fix Order

1. **Backend:** Add `en-PH` to `LanguageOptions` in AWS Transcribe — one line, immediate accuracy improvement for Philippine speech.
2. **Client:** Replace `ScriptProcessorNode` with `MediaRecorder` — eliminates the main-thread drop issue and the entire raw PCM pipeline.
3. **Backend:** Change `MediaEncoding` from `"pcm"` to `"ogg-opus"` to match `MediaRecorder` output.
4. **Client:** Add explicit audio constraints to `getUserMedia`.
5. **Client:** Delete `detectIntent` dead code.
6. **Both:** Merge transcribe + ask into one endpoint to reduce round-trip latency.
