# Mirror App — System Progress

## Overview

Single kiosk instance with one persistent authenticated user per device. No per-visitor login or QR flow. Each new person selects their gender on entry, which updates the shared profile, then proceeds to the feature hub. Two kiosks are supported via domain-based token selection.

---

## User Flow

```
/ (Splash)
└─ tap "Touch to Start Now"
     ▼
/select-gender  — "What's your gender?"
     └─ tap Male or Female
          └─ updateProfile({ gender }) + setAuthCookie()
               └─ sessionStorage.setItem("mirror_gender", gender)
               ▼
         /authentication  — "What are you here for?"  ◄── END OF ONBOARDING FLOW
              │
              │  Final destination of the onboarding flow.
              │  User is identified (gender set) and presented
              │  with the three features available on the kiosk.
              │  Each card launches an independent feature session.
              │
              ├─ Style your Fashion  →  /ai-recommendation-fashion
              ├─ Cosmetics & Skincare →  /ai-recommendation-cosmetic
              │                              └─ /ai-recommendation-cosmetic/result
              ├─ Explore the map     →  /map
              └─ overview of the user selected → /overview

         [Restart] on any page → /  (resets to splash, new visitor starts fresh)
```

---

## Routes

| Constant                            | Path                                 | Description                                                  |
| ----------------------------------- | ------------------------------------ | ------------------------------------------------------------ |
| `WELCOME`                           | `/`                                  | Splash / attract screen                                      |
| `SELECT_GENDER`                     | `/select-gender`                     | Gender prompt — always first step                            |
| `LOGGED_IN`                         | `/authentication`                    | Feature hub — end of onboarding                              |
| `OVERVIEW`                          | `/overview`                          | Session summary — shows user info, gender, feature shortcuts |
| `AI_RECOMMENDATION_FASHION`         | `/ai-recommendation-fashion`         | Fashion AI flow                                              |
| `AI_RECOMMENDATION_COSMETIC`        | `/ai-recommendation-cosmetic`        | Cosmetic / skin analysis                                     |
| `AI_RECOMMENDATION_COSMETIC_RESULT` | `/ai-recommendation-cosmetic/result` | Cosmetic results                                             |
| `MAP`                               | `/map`                               | Store map                                                    |

---

## Middleware (proxy.ts)

Single auth rule: unauthenticated visitor on a protected route → redirect to `/`.

**Protected:** `/authentication`, `/overview`, `/ai-recommendation-fashion`, `/ai-recommendation-cosmetic`, `/ai-recommendation-cosmetic/result`

**Public:** `/` (splash), `/select-gender`, `/map`, `/virtual-mirror`

---

## Two-Kiosk Setup

Token selection happens **at runtime** via `window.location.hostname` — not baked in at build time. Both tokens are in every build; the device's hostname determines which one is used.

```
window.location.hostname === NEXT_PUBLIC_DOMAIN2  →  NEXT_PUBLIC_USER2_ACCESS_TOKEN
otherwise                                          →  NEXT_PUBLIC_USER1_ACCESS_TOKEN
```

**`.env` (same file on both devices, one build):**

```
NEXT_PUBLIC_DOMAIN1=local.mirror1          ← kiosk 1 hostname
NEXT_PUBLIC_DOMAIN2=local.mirror2          ← kiosk 2 hostname

NEXT_PUBLIC_USER1_ACCESS_TOKEN=<token>     ← kiosk 1 JWT
NEXT_PUBLIC_USER2_ACCESS_TOKEN=<token>     ← kiosk 2 JWT (both filled in)
```

**Real devices:** set each Orange Pi hostname to `local.mirror1` or `local.mirror2`.

**Local testing kiosk 2:** change `NEXT_PUBLIC_DOMAIN2=localhost` in `.env` → rebuild → browser on `localhost` picks User 2 token.

Each kiosk updates its own backend user profile (gender etc.) via its JWT — no cross-kiosk contamination.

---

## Key Files

| File                                      | Role                                                                                         |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| `navigation.ts`                           | Route constants + middleware protection rules                                                |
| `proxy.ts`                                | Next.js middleware — auth guard                                                              |
| `app/page.tsx`                            | Splash screen — tap goes to `/select-gender`                                                 |
| `app/select-gender/page.tsx`              | Gender prompt — domain-based token selector, `updateProfile`, saves gender to sessionStorage |
| `app/authentication/page.tsx`             | Feature picker hub                                                                           |
| `app/overview/page.tsx`                   | Session overview — displayName, gender, feature shortcuts                                    |
| `app/ai-recommendation-fashion/page.tsx`  | Fashion flow                                                                                 |
| `app/ai-recommendation-cosmetic/page.tsx` | Cosmetics flow                                                                               |
| `app/map/page.tsx`                        | Map                                                                                          |

---

## What Was Removed

| Removed                                                           | Reason                                                                                   |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| QR code flow (`/qrcode`, `QrCodeView`)                            | No per-visitor login — one persistent kiosk user                                         |
| `KioskNotificationListener`                                       | Socket-based login events no longer needed                                               |
| Testing pages (`testing-waiting-*`, `testing-personalize-outfit`) | Cleaned up                                                                               |
| `modules/sample/`                                                 | Unused scaffold                                                                          |
| Route sequence enforcement (step cookies)                         | Replaced with simple binary auth check                                                   |
| `guestOnly` / `sequences` route rules                             | Simplified to single `protected` list                                                    |
| `NEXT_PUBLIC_KIOSK_ID` / `NEXT_PUBLIC_DOMAIN`                     | Replaced by `NEXT_PUBLIC_DOMAIN1` + `NEXT_PUBLIC_DOMAIN2` for runtime hostname detection |

---

## Session

- Token: selected at **runtime** via `window.location.hostname` vs `NEXT_PUBLIC_DOMAIN2` — match → User 2, else → User 1
- Cookie: `mirror_session` — set via `setAuthCookie()` after gender selection
- Gender: stored in `sessionStorage` as `mirror_gender` for display on `/overview`
- Per-visitor: `authService.updateProfile({ gender })` called on each gender pick
- No logout — Restart navigates back to `/`

---

## Lint & Build Status

- **Lint:** clean
- **Build:** clean — 17 pages
