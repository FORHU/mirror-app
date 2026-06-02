# Backend Fix: Voice `maps_navigate` Intent Classification

## What's broken

The `/api/mirror/voice/ask` endpoint mishandles the "navigate me to [physical place]" intent in two ways.

### Problem 1 — Wrong action type from non-map pages

When `ctx.currentPage` is not `"Map"`, saying _"navigate me to SM Baguio"_ returns either no action or the wrong action type. The frontend receives no `maps_navigate` action and nothing happens. The AI reply doesn't mention the destination at all.

### Problem 2 — Unnecessary confirmation on the map page

When `ctx.currentPage` is `"Map"`, the same phrase correctly identifies the maps intent but returns `requiresConfirmation: true` with a reply like _"are you sure you want to leave the map?"_ — even though the user is already on the map and just wants to set a destination. Confirmation should not be required for this case.

---

## What the frontend expects

For _"navigate me to [place]"_ / _"take me to [place]"_ / _"directions to [place]"_, the correct response is:

```json
{
  "action": {
    "type": "maps_navigate",
    "destination": "SM Baguio"
  },
  "requiresConfirmation": false,
  "reply": "Navigating to SM Baguio."
}
```

The `destination` field should be the extracted place name exactly as the user said it. The frontend handles geocoding on its own.

---

## Classification rules to enforce

| Intent pattern | Correct action type | `requiresConfirmation` |
|---|---|---|
| "navigate to [place]" | `maps_navigate` | `false` |
| "take me to [place]" | `maps_navigate` | `false` |
| "directions to [place]" | `maps_get_directions` | `false` |
| "show me [place] on the map" | `maps_preview_location` | `false` |
| "go to the map" / "open the map" | `navigate` → `route: "/map"` | depends on flow |

**Key rule**: If the destination is a physical location (place name, address, landmark), always return `maps_navigate` or `maps_get_directions` — regardless of what `ctx.currentPage` is. The `navigate` action type is only for app-screen routing (e.g. _"go to the overview"_, _"open fashion"_).

---

## Available context fields

The request body includes a `ctx` object with the following relevant fields:

| Field | Type | Description |
|---|---|---|
| `ctx.currentPage` | `string` | e.g. `"Map"`, `"Overview"` |
| `ctx.navigating` | `boolean` | `true` if actively navigating |
| `ctx.lat` | `number` | User's current latitude |
| `ctx.lng` | `number` | User's current longitude |

`maps_navigate` should never require confirmation based on `ctx.currentPage`. The frontend manages flow-transition confirmations independently for page navigation actions.

---

## Action type reference

These are the valid action types the frontend handles for maps:

```ts
| { type: "maps_navigate"; destination: string }
| { type: "maps_preview_location"; query: string; label: string }
| { type: "maps_get_directions"; destination: string; mode?: "driving" | "walking" | "transit" }
| { type: "maps_suggest_places"; category: "food" | "coffee" | "activities" | "shopping" | "medical" | "transit"; label: string }
| { type: "traffic_on" }
| { type: "traffic_off" }
| { type: "stop_navigation" }
```

Any unrecognized action type falls through to a no-op on the frontend.
