# Mirror App Navigation Process

This document outlines how navigation is handled within the `mirror-app` frontend. Because this is a Smart Mirror interface, navigation is heavily driven by both standard touch interactions and real-time Voice Commands.

## 1. Core Architecture (Next.js App Router)
The frontend utilizes the **Next.js App Router** (`/app` directory). 
- Every folder inside `/app` represents a distinct route (e.g., `/app/map` -> `localhost:3000/map`).
- All valid route paths are strictly typed and centralized in `navigation.ts` to prevent broken links.

```typescript
// navigation.ts
export const ROUTES = {
  WELCOME: "/",
  SELECT_GENDER: "/select-gender",
  LOGGED_IN: "/authentication",
  AI_RECOMMENDATION_FASHION: "/ai-recommendation-fashion",
  MAP: "/map",
  // ...
} as const;
```

## 2. Voice-Driven Navigation (`VoiceProvider.tsx`)

The most unique aspect of the mirror is how voice commands instantly manipulate the screen. This is handled by the global `VoiceProvider`.

### The Voice Pipeline:
1. **User Speaks**: The frontend streams audio to the Node.js backend (`voice.service.ts`).
2. **Backend Intercepts**: The backend uses regex to check for UI shortcuts (e.g., `"style my fashion"`).
3. **Action Dispatched**: If a shortcut matches, the backend skips Chat Wonder and immediately returns a JSON action: `{ type: "navigate", route: "/outfit-builder" }`.
4. **Frontend Routes**: `VoiceProvider.tsx` catches this action and uses the Next.js router to instantly change the screen.

```typescript
// How VoiceProvider routes the user
const dispatchAction = useCallback((action: ChatWonderAction) => {
  if (action.type === "navigate") {
    router.push(action.route); // Instantly swaps the screen!
  } 
  // ...
});
```

## 3. Map & Hardware Navigation
Navigation isn't just about changing pages; it also involves changing the state of hardware or specific UI components (like the Map).

### Session Storage Hand-offs
If a user is on the Home Screen and says *"Navigate to Starbucks"*:
1. The backend recognizes a physical map destination.
2. `VoiceProvider` sees `{ type: "maps_navigate", destination: "Starbucks" }`.
3. Because the user is NOT on the map screen, `VoiceProvider` saves the destination to `sessionStorage` and pushes the user to the `/map` route.
4. When the Map component mounts, it reads `sessionStorage` and immediately begins the Turn-by-Turn directions process.

```typescript
// VoiceProvider.tsx (Map Handoff)
} else if (action.type === "maps_navigate") {
  if (pathname.startsWith("/map")) {
    // Already on map, search instantly
    mapService.geocode(action.destination)...
  } else {
    // Not on map, save state and route there
    sessionStorage.setItem(
      "mirror_pending_map_directions",
      JSON.stringify({ destination: action.destination })
    );
    router.push(ROUTES.MAP);
  }
}
```

## 4. Protected Routes
The mirror has states where a user might not be logged in or recognized. `navigation.ts` exports a `ROUTE_RULES.protected` array which specifies which screens require the user to be fully authenticated. 

```typescript
export const ROUTE_RULES = {
  protected: [
    ROUTES.LOGGED_IN,
    ROUTES.OVERVIEW,
    ROUTES.AI_RECOMMENDATION_FASHION,
  ]
}
```
If a user (or voice command) attempts to route to these pages without a valid session, middleware or context guards will intercept the navigation and prompt for authentication.
