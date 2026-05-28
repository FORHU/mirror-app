# Chat-wonder voice session resets on Attract screen

Arriving at `/` (the **Attract screen**) resets the chat-wonder **Voice session** — both the `sessionId` ref and the `historyRef` (last 4 turns) inside `VoiceProvider`, plus the `chatHistory` UI state. This is the *only* state the pathname effect touches. Auth teardown, server pairing release, and gender clearing are not its responsibility.

**Why pathname-coupled:** the voice session lives inside React component state and there is no other natural cross-cutting event that maps to "a new chat-wonder conversation should begin." Pathname `/` is the canonical "ready for a fresh user" signal, so a fresh voice session starts there.

**Trade-off accepted:** any future `router.push('/')` for non-attract reasons will also drop the voice session. Code authors must treat navigation to `/` as "begin a new conversation." Auth and kiosk-pairing teardown remain the responsibility of explicit callers (`endKioskSession`, Navbar logout, idle-timeout hook).

**Out of scope for this ADR (open issues):**
- The Overview "Restart" button navigates to `/` without calling `endKioskSession`, leaking the server-side **Kiosk pairing** lock.
- **Gender selection** in `sessionStorage["mirror_gender"]` has no owner for clearing — it persists across visitors until something explicitly removes it.
- `flowState.ts` checks `pathname === "/welcome"` but no route renders that path; `ROUTES.WELCOME` is `/`. Dead check.
- `docs/navigation-process.md` and `modules/shared/voice/voiceprovider_progress.md` describe a regex fast-path (`detectIntent`, `dispatchAction`) that does not exist in the code. The actual orchestration is `runKernel` → `guardAction` → `executeAction`. Docs should be rewritten or deleted.
