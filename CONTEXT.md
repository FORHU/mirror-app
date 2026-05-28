# Mirror App

The kiosk display software that runs on the physical smart mirror. Public, shared hardware — not a personal device. Cycles between waiting for a user (**Attract**) and serving a paired user.

## Language

**Attract screen**:
The screen the mirror shows while waiting for a new user. Lives at route `/` (also called the Welcome screen in code). Each arrival on the Attract screen is treated as a brand-new user — voice session, gender selection, and auth are reset.
_Avoid_: Welcome screen, splash, home

**Session**:
Ambiguous — disambiguate as **Voice session**, **Auth session**, or **Gender selection**. See _Flagged ambiguities_.

**Voice session**:
The continuity unit for chat-wonder conversation. Comprises the in-memory `sessionId` (which the server uses to thread turns into a single upstream conversation) AND the last-4-turns `historyRef` used for UI display. Both reset together on arrival at the **Attract screen**. Lives on the client only.

**Pending action**:
A voice-emitted action that has been deferred awaiting a yes/no answer from the user. Set when EITHER the server's response has `requiresConfirmation: true` OR the client's `actionGuard` flags the action as confirmation-required for the current pathname. On "yes", the action is re-checked through `guardAction` (block rules like **Gender selection** still apply) before being executed. On "no" or timeout, it is discarded.

**Auth session**:
The kiosk's signed-in identity. Each mirror is permanently bound to one user account via a hostname-keyed JWT baked into `.env`. The token is installed by `installKioskAuth()` on every page mount (from `AuthInitializer`). Because the install is unconditional, there is no real "logout" — token-clearing paths are immediately undone by the next mount. Independent of **Gender selection**.

**Gender selection**:
A `MALE`/`FEMALE` choice stored in `sessionStorage["mirror_gender"]`. Gates fashion and cosmetics features.

**Return to Attract**:
The product's "end-the-current-flow" operation. Triggered by the idle-timeout hook (5 min), the Overview "Restart" button, or voice navigation back to `/`. Effect: navigate to `/`. Does NOT touch the **Auth session** — the kiosk's identity is permanent (see [ADR 0002](docs/adr/0002-kiosk-has-no-logout.md)). The only state that resets is the **Voice session** (via `VoiceProvider`'s pathname effect).

## Relationships

- A user arriving at the **Attract screen** has no **Voice session**, no **Auth session**, and no **Gender selection**.
- The **Auth session** is established by the Companion App over QR pairing, not on the mirror itself.
- **Gender selection** gates only fashion/cosmetics; maps and other features bypass it.

## Flagged ambiguities

- "session" was used to mean three different things (voice, auth, gender). Disambiguated above.
- "Welcome" and "Attract" used interchangeably for `/`. Canonical term is **Attract screen**.
- "Logout" — the product has no logout. The canonical operation is **Return to Attract**. The hook `useIdleLogout` is misnamed (it's a "return-to-attract on idle") but renaming it touches the entire auth flow's pseudo-history; left alone for now.
