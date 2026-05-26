# Mirror App — System Progress

## Overview

Single kiosk with one persistent authenticated user (token set via `NEXT_PUBLIC_USER1_ACCESS_TOKEN`). No per-visitor login or QR flow. Each new person selects their gender on entry, which updates the shared profile, then proceeds to a feature.

---

## User Flow

```
/ (Splash)
└─ tap "Touch to Start Now"
     ▼
/select-gender  — "What's your gender?"
     └─ tap Male or Female
          └─ updateProfile({ gender }) + setAuthCookie()
               ▼
         /authentication  — "What are you here for?"  ◄── END OF FLOW
            │  │
            │  │  This is the final destination of the onboarding flow.
            │  │  The user has been identified (gender set) and is now
            │  │  presented with the three features available on the kiosk.
            │  │  Each card launches an independent feature session.
            │  │
            │  ├─ Style your Fashion  →  /ai-recommendation-fashion
            │  ├─ Cosmetics & Skincare →  /ai-recommendation-cosmetic
            │  │                              └─ /ai-recommendation-cosmetic/result
            │  └─ Explore the map     →  /map
            └─ overview of the user selected -> /overview

         [Restart] on any page → /  (resets to splash, new visitor starts fresh)
```

---

## Routes

| Constant | Path | Description |
|---|---|---|
| `WELCOME` | `/` | Splash / attract screen |
| `SELECT_GENDER` | `/select-gender` | Gender prompt — always first step |
| `LOGGED_IN` | `/authentication` | Feature hub — pick Fashion, Cosmetics, or Map |
| `AI_RECOMMENDATION_FASHION` | `/ai-recommendation-fashion` | Fashion AI flow |
| `AI_RECOMMENDATION_COSMETIC` | `/ai-recommendation-cosmetic` | Cosmetic / skin analysis |
| `AI_RECOMMENDATION_COSMETIC_RESULT` | `/ai-recommendation-cosmetic/result` | Cosmetic results |
| `MAP` | `/map` | Store map |

---

## Middleware (proxy.ts)

Single auth rule: unauthenticated visitor on a protected route → redirect to `/`.

**Protected:** `/select-gender`, `/authentication`, `/ai-recommendation-fashion`, `/ai-recommendation-cosmetic`, `/ai-recommendation-cosmetic/result`

**Public:** `/` (splash), `/map`, `/virtual-mirror`

---

## Key Files

| File | Role |
|---|---|
| `navigation.ts` | Route constants + middleware protection rules |
| `proxy.ts` | Next.js middleware — auth guard |
| `app/page.tsx` | Splash screen — tap goes to `/select-gender` |
| `app/select-gender/page.tsx` | Gender prompt — `updateProfile` then → `/authentication` |
| `app/authentication/page.tsx` | Feature picker hub |
| `app/ai-recommendation-fashion/page.tsx` | Fashion flow |
| `app/ai-recommendation-cosmetic/page.tsx` | Cosmetics flow |
| `app/map/page.tsx` | Map |

---

## What Was Removed (this branch)

| Removed | Reason |
|---|---|
| QR code flow (`/qrcode`, `QrCodeView`) | No per-visitor login — one persistent kiosk user |
| `KioskNotificationListener` | Socket-based login events no longer needed |
| Testing pages (`testing-waiting-*`, `testing-personalize-outfit`) | Cleaned up |
| `modules/sample/` | Unused scaffold |
| Route sequence enforcement (step cookies) | Replaced with simple binary auth check |
| `guestOnly` / `sequences` route rules | Simplified to single `protected` list |

---

## Session

- Token: `NEXT_PUBLIC_USER1_ACCESS_TOKEN` — set once for the kiosk
- Cookie: `mirror_session` — set via `setAuthCookie()` after gender selection
- Per-visitor: `authService.updateProfile({ gender })` called on each gender pick
- No logout — Restart navigates back to `/`
