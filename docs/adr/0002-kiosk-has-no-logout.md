# Kiosk has no logout

The Mirror App is permanently bound to one user account per device, identified by `window.location.hostname` → a JWT baked into `.env` (`NEXT_PUBLIC_USER1_ACCESS_TOKEN` / `USER2_*`). `AuthInitializer` installs this JWT unconditionally on every page mount via `installKioskAuth()`. As a result, there is no product concept of "logout" — only **Return to Attract**.

**Consequences for code:**
- The Navbar "Logout" button is removed. The Overview "Restart" button, idle timeout, and voice navigation cover the return-to-Attract need.
- Idle timeout (`useIdleLogout`) only navigates to `/`; tokens are not cleared.
- `useAuthStore` no longer has `login`, `logout`, or `_forceLogout`. The store tracks `user` / `isAuthenticated` for display only; install is owned exclusively by `installKioskAuth()`.
- `_init` fetches the user via `authService.getCurrentUser()` whenever a token is present, so `isAuthenticated` reflects "we have a working identity" on cold load.
- Dead code deleted: `proxy.ts` (never wired as Next middleware), `auth-cookie.ts` (cookie had no readers), `end-kiosk-session.ts`, `kiosk.service.ts`, `useKioskSocket.ts`, `socket-events.ts`, `socket-client.ts`.

**Why this shape:** the JWTs in `.env` are not dev fixtures — they are the deployed kiosk identities. A real `.env` change is the only thing that can re-identify a kiosk. Token-clearing followed by `AuthInitializer` re-installing the same token is just churn; calls to `authService.logout()` are actively dangerous because they target a token the kiosk has no other way to refresh.

**Rejected alternatives:**
- **Gate `installKioskAuth()` behind `NODE_ENV`** so production would require Companion pairing. Rejected: no Companion pairing flow is wired up; `useKioskSocket` is defined but never called.
- **Cycle tokens off and on per "logout"** (current behavior before this ADR). Rejected: wasteful, creates an unauthenticated flicker window, and the server-side `authService.logout()` call can permanently invalidate the refresh token.
