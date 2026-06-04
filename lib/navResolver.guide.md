# Navigation (`[nav]`) — How It Works

Deterministic, on-device page traversal for the AI assistant. Resolves
navigation commands to real app routes **before** calling ChatWonder.

## Why this exists

The external **ChatWonder agent is a fashion/styling persona** — it does **not**
understand navigation. Asking it to "go to cosmetics" returns `intent: "NONE"`
with no `[NAV_DATA]` block (it even falls back to asking for weather/location),
so the kiosk never moves. We verified this directly: the same nav request fails
identically *with or without* weather/location.

So navigation is resolved **on our side**, against the app's real `ROUTES`.

## The flow

```
user speech / text
      │
      ▼
/api/mirror/ai-assistant  (Next.js route.ts)
      │
      ├─ resolveNav(message)  ──► match? ──► return { reply, route, routeLabel }   ← NAV (instant, no ChatWonder)
      │                                            │
      │                                            ▼
      │                                   page.tsx: speakText(reply) → router.push(route)
      │
      └─ no match ──► ChatWonder /chat-wonder/message  ← styling questions, everything else
```

- **Nav command** (`[nav] ...` tag, or a movement verb like "go to / open /
  take me to") → resolved here, returns a real route. ChatWonder is skipped.
- **Anything else** ("what cosmetics suit me", "rate my outfit") → falls through
  to ChatWonder unchanged.

## Files

| File | Role |
|------|------|
| `lib/navResolver.ts` | The resolver: intent gate + alias→route matching. |
| `app/api/mirror/ai-assistant/route.ts` | Calls `resolveNav()` and short-circuits when it matches. |
| `navigation.ts` | `ROUTES` — the single source of truth the resolver maps to. |
| `app/ai-assistant/page.tsx` | Consumes `route` → `router.push()` after speaking. |

## Triggering rules

A message is treated as navigation when **either**:

1. It starts with the **`[nav]`** tag — e.g. `[nav] cosmetics`, or
2. It contains a **movement verb**: `go to`, `open`, `navigate to`, `take me
   to`, `switch to`, `jump to`, `head to`, `go back`, …

…**and** it contains a target **alias**. "show me" is intentionally **excluded**
so "show me an outfit" stays a styling request.

### Examples (verified)

| Input | Result |
|-------|--------|
| `navigate to the cosmetics screen` | → `/ai-recommendation-cosmetic` |
| `[nav] cosmetics` | → `/ai-recommendation-cosmetic` |
| `go to map` | → `/map` |
| `open fashion` | → `/ai-recommendation-fashion` |
| `take me to the AI assistant` | → `/ai-assistant` |
| `go back` | → `/` |
| `what cosmetics suit me` | → ChatWonder (no nav) |
| `show me an outfit` | → ChatWonder (no nav) |

## How to add / change a destination

Edit `NAV_TARGETS` in `lib/navResolver.ts`. Each entry:

```ts
{
  route: ROUTES.SOME_ROUTE,   // must exist in navigation.ts
  label: "the Map",           // spoken back as: "Sure — opening the Map."
  aliases: ["map", "maps"],   // lowercase whole-word keywords
}
```

Rules of thumb:
- Aliases match **whole words**, case-insensitive (`map` won't match `mapping`).
- Add natural synonyms users actually say ("makeup", "beauty" for cosmetics).
- To add a new verb phrase, extend the `NAV_VERBS` regex.

## Forcing navigation from the kiosk

Prepend **`[nav]`** to the message. That bypasses the verb requirement and goes
straight to alias matching — e.g. send `[nav] qr code` to always open the QR page.

## Testing

```bash
# end-to-end against the running Next dev server (port 3000)
curl -s -X POST http://localhost:3000/api/mirror/ai-assistant \
  -H "Content-Type: application/json" \
  -d '{"message":"go to cosmetics"}'
# => {"reply":"Sure — opening Cosmetics.","route":"/ai-recommendation-cosmetic","routeLabel":"Open page"}
```

## Notes

- The resolver requires no rebuild — Next.js hot-reloads `route.ts` and `lib/`.
- ChatWonder still receives `sitemap_context`; if its agent is ever upgraded to
  emit `[NAV_DATA]`, that path still works as a fallback for unmatched phrases.
- A nav match never persists a conversation or calls the external AI — it's
  instant and free.
