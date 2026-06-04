---
name: mirror-app-map
description: Domain glossary for the Mirror App map feature
metadata:
  type: project
---

# Map Feature — Domain Glossary

## Core Terms

**Destination** — a single geocoded location the user has chosen to navigate to. Has `name`, `lat`, `lng`, `address`, `placeId`. Set by `setDestination()`. Mutually exclusive with an active Itinerary.

**ItineraryStop** — one of N sequential destinations in a multi-event route. Each stop is assigned a **StopColor** from the fixed palette. Stored in `itineraryStops[]` in `useMapStore`. Mutually exclusive with a single Destination.

**StopColor** — a color assigned to an ItineraryStop by its zero-based index into the fixed palette: `[yellow, blue, red, green, orange, purple]`. Cycles if stops exceed palette length. Applies to both the stop's route leg and its pin.

**ItineraryRoute** — the route leg connecting two consecutive ItineraryStops (or user origin → first stop). Rendered in the same StopColor as its destination stop. Stored in `itineraryRoutes[]`.

**ItineraryPOI** — a nearby place of interest associated with a specific ItineraryStop. Displayed as a small circle marker on the map, color-matched to its parent stop's StopColor. Up to 2–3 ItineraryPOIs are shown per stop. Not the same as a SuggestedPOI.

**SuggestedPOI** — a curated place returned when the user asks for a category search in single-destination mode (e.g. "find me a restaurant"). Shown in `POICurationStack`. Not used in itinerary mode.

**StopPOICard** — the detail card shown when a user voices the name of an ItineraryPOI. Displays: venue photo, star rating, walking travel time from its parent ItineraryStop, car travel time from its parent ItineraryStop. Rendered via the existing `ExploreHUD` / `setSelectedPOI` flow.

**ItineraryBuildingMode** — the state while a user is adding stops sequentially, one voice turn at a time. Active when ChatWonder returns `intent: "itinerary_setup"`. The AI accumulates stops via conversation history and asks "Any more stops?" after each turn. Routes are NOT drawn during this state. Exits to **ItineraryResolvedMode** when the user says a finish phrase ("done", "go", "that's all", etc.).

**ItineraryResolvedMode** — triggered when ChatWonder returns `intent: "itinerary_resolved"`. The AI returns ALL accumulated stops with resolved lat/lng. The frontend calls `setItineraryStops()` and draws the full color-coded route.

**FinishPhrase** — a spoken cue that signals the user is done adding stops: "that's all", "done", "go", "that's it", "no more", "start", "let's go", "that's everything", "start navigation". Detected by the ChatWonder map persona, not the frontend.

**isPanning** — a boolean flag in `useMapStore` indicating the map camera animation is in progress. Set to `true` before any `map.fitBounds()` or `map.easeTo()` call. Cleared to `false` by the Mapbox `moveend` event. Gates both `POICurationStack` rendering and TTS audio playback.

**Map Settle** — the moment `isPanning` transitions from `true` to `false` (Mapbox fires `moveend`). This is the earliest point at which POI cards and TTS audio are allowed to appear.
