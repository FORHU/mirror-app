# Mirror App — Domain Context

## Glossary

### Session
A single user's interaction cycle at the mirror, from proximity detection to walk-away. A Session has a **Session ID** (the ChatWonder conversation ID). Sessions are isolated: one person at a mirror = one Session.

### Restart
Ends the current Session and starts a new one with a **new Session ID**. Clears the ChatWonder conversation, wipes the active Outline, resets local stores, and returns to the Landing Page. Triggered manually via the Restart Button or automatically when the proximity sensor detects the user has walked away.

### Refresh
Returns to the Landing Page while **preserving the current Session ID**. The ChatWonder conversation history and Outline data are not cleared. Used by the Home Button (top-left).

### Landing Page
The `/ai-assistant` route. Entry point for every Session. Shows the Idle Screen until proximity is detected or a tap occurs, then transitions to the Active Screen.

### Idle Screen
The full-screen video backdrop state of the Landing Page shown when no user is present. Tapping the Idle Screen wakes the mirror into the Active Screen.

### Active Screen
The conversation state of the Landing Page shown after wake. Displays the chat exchange, mic button, Nav Buttons, and Quick Response Chips.

### Proximity Sensor
The camera-based face detection system (`useProximitySensor`) that determines whether a user is standing at the mirror. Drives the Idle/Active Screen transition and the automatic Restart on walk-away.

### Nav Buttons
Four touch buttons on the Active Screen of the Landing Page that directly navigate (`router.push`) to the four feature pages: Fashion, Cosmetics, Map, Overview. No AI call is made — navigation is instant.

### Quick Response Chips
Glassmorphism pill buttons present on every page. Appear when the voice pipeline is idle (not listening, processing, or speaking). Each chip submits a pre-written context-specific prompt via `submitText` (direct text-to-AI, bypassing the microphone). Dynamic date placeholders are computed at render time.

### Re-arm Loop
The previous behavior where the mic was automatically re-started 400ms after each voice turn ended. **Removed.** Voice now rests idle after each reply, allowing Quick Response Chips to surface.

### submitText
Sends a text prompt directly to the ChatWonder AI endpoint, bypassing speech recognition and TTS. Fast path — identical latency to Postman/typing. Used by Quick Response Chips.

### Outline
The server-persisted record of a user's current session plan — selected outfits, cosmetics recommendations, and itinerary stops. Refreshed (re-fetched) on Overview load. Wiped on Restart.

### Skin Analysis
A background camera capture + AI analysis run silently when the user first arrives at the mirror. Result is stored in `useMirrorStore.skinAnalysisResult` and passed to Cosmetics and Overview modes.

### Overview Mode
The `/overview` page and `pageMode: "overview"` ChatWonder mode. Populates all four tiles (garments, outfits, cosmetics, map) from a single ChatWonder call. Downstream dashboard — does not greet the user.

### Garment Mode
`pageMode: "garment"` ChatWonder mode used on the Fashion page. Returns outfit sets resolved from the real DB catalog via `resolveSetOutfits`.

### Cosmetics Mode
`pageMode: "cosmetics"` ChatWonder mode used on the Cosmetics page. Uses `buildCatalogContext` to ground recommendations in real product IDs from the DB. Scores products against the user's skin profile.

### Map Mode
`pageMode: "map"` ChatWonder mode used on the Map page. Handles POI queries (`nearbyPOIs`), multi-event itinerary routing (`isMultiEventUtterance`), and directions (Mapbox / ORS).

### Restart Button
A fixed bottom-right ghost button present on every page. Calls `performRestart()` — new Session ID, navigate to Landing Page.

### Home Button
A top-left button added to `MirrorHeader` by the team (separate task). Calls `router.push(ROUTES.WELCOME)` — same Session ID, navigate to Landing Page (Refresh).
