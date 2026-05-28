import type { ChatWonderAction } from "../../ai/chatwonder.types";
import { useMapStore } from "@/modules/map/store/useMapStore";
import { useCalendarStore } from "@/modules/shared/store/useCalendarStore";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";
import { mapService } from "@/modules/map/services/map.service";
import { ROUTES } from "@/navigation";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export async function executeAction(
  action: ChatWonderAction,
  router: AppRouterInstance,
  pathname: string,
  onAction?: (action: ChatWonderAction) => void,
) {
  if (!action) return;

  switch (action.type) {
    case "navigate": {
      const { setAiSuggestion, clearAiSuggestion } = useMirrorStore.getState();

      if (action.suggestion) setAiSuggestion(action.suggestion);
      else clearAiSuggestion();

      router.push(action.route ?? ROUTES.WELCOME);
      return;
    }

    case "maps_preview_location":
    case "maps_get_directions":
    case "maps_navigate": {
      const dest = action.destination || action.query;
      if (!dest || dest.trim() === "") {
        router.push(ROUTES.MAP);
        return;
      }

      const map = useMapStore.getState();
      const loc = map.userLocation ?? map.homeLocation ?? undefined;

      const { results } = await mapService.geocode(dest, loc);

      if (!results.length) {
        router.push(ROUTES.MAP);
        return;
      }

      useMapStore.setState({
        selectedDestination: results[0],
        activeRoute: null,
        isSearching: false,
        searchResults: [],
      });

      await useMapStore.getState().fetchRoute();
      useMapStore.getState().startNavigation();
      return;
    }

    case "traffic_on":
      if (!useMapStore.getState().showTraffic)
        useMapStore.getState().toggleTraffic();
      return;

    case "traffic_off":
      if (useMapStore.getState().showTraffic)
        useMapStore.getState().toggleTraffic();
      return;

    case "set_profile":
      useMapStore
        .getState()
        .setActiveProfile(
          action.profile as "car" | "motorcycle" | "bicycle" | "walking",
        );
      return;

    case "calendar_save_event":
      useCalendarStore.getState().addEvent({
        title: action.title!,
        eventType: action.eventType!,
        dateTime: action.dateTime!,
        location: action.location!,
      });
      return;

    case "maps_suggest_places": {
      const map = useMapStore.getState();
      const loc = map.userLocation ?? map.homeLocation;
      if (!loc) return;

      const CATEGORY_MAP: Record<string, string> = {
        food: "restaurant",
        coffee: "cafe",
        activities: "attraction",
        shopping: "shop",
        medical: "medical",
        transit: "transit",
      };
      const fsqCategory = CATEGORY_MAP[action.category] ?? action.category;

      try {
        const { pois } = await mapService.nearbyPOIs(
          loc.lat,
          loc.lng,
          1500,
          fsqCategory,
        );
        useMapStore.getState().setSuggestedPOIs(pois, action.label);
      } catch {
        // silently ignore — voice reply already handles the response
      }
      return;
    }

    default:
      onAction?.(action);
  }
}
