import type { ChatWonderAction } from "../../ai/chatwonder.types";
import { useMapStore } from "@/modules/map/store/useMapStore";
import { useCalendarStore } from "@/modules/shared/store/useCalendarStore";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";
import { mapService } from "@/modules/map/services/map.service";
import {
  buildPOITTS,
  curatePOIs,
} from "@/modules/map/utils/chatWonderMapUtils";
import { ROUTES } from "@/navigation";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export async function executeAction(
  action: ChatWonderAction,
  router: AppRouterInstance,
  pathname: string,
  onAction?: (action: ChatWonderAction) => void,
  options?: { onSuggestPlaces?: (tts: string) => void },
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

    case "maps_navigate": {
      const dest = action.destination;
      if (!dest?.trim()) return;

      const map = useMapStore.getState();
      const loc = map.userLocation ?? map.homeLocation ?? undefined;
      const { results } = await mapService.geocode(dest, loc);
      if (!results.length) return;

      await useMapStore.getState().setDestination(results[0]);
      return;
    }

    case "maps_get_directions": {
      const dest = action.destination;
      if (!dest?.trim()) return;

      const map = useMapStore.getState();
      const loc = map.userLocation ?? map.homeLocation ?? undefined;
      const { results } = await mapService.geocode(dest, loc);
      if (!results.length) return;

      await useMapStore.getState().setDestination(results[0]);
      return;
    }

    case "maps_preview_location": {
      const query = action.query;
      if (!query?.trim()) return;

      const map = useMapStore.getState();
      const loc = map.userLocation ?? map.homeLocation ?? undefined;
      const { results } = await mapService.geocode(query, loc);
      if (!results.length) return;

      await useMapStore.getState().setDestination(results[0]);
      return;
    }

    case "maps_show_route": {
      const a = action as { destination?: string; query?: string };
      const dest = a.destination || a.query;
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

      if (!pathname.startsWith("/map")) {
        router.push(ROUTES.MAP);
      }

      await useMapStore.getState().setDestination(results[0]);
      return;
    }

    case "maps_clear_route":
    case "stop_navigation":
      useMapStore.getState().clearRoute();
      return;

    case "maps_camera_overview":
      useMapStore.getState().setCameraMode("overview");
      return;

    case "maps_camera_free":
      useMapStore.getState().setCameraMode("free");
      return;

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
          action.profile === "motorcycle" ? "car" : action.profile,
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
      const loc =
        map.selectedDestination ?? map.userLocation ?? map.homeLocation;
      if (!loc) return;

      const CATEGORY_MAP: Record<string, string> = {
        food: "restaurant",
        coffee: "cafe",
        activities: "attraction",
        shopping: "shop",
        medical: "medical",
        transit: "transit",
      };
      const googleCategory = CATEGORY_MAP[action.category] ?? action.category;

      // Fire in background — don't block the voice response
      mapService
        .nearbyPOIs(loc.lat, loc.lng, 1500, googleCategory)
        .then(({ pois }) => {
          const curated = curatePOIs(pois);
          useMapStore.getState().setSuggestedPOIs(curated, action.label);
          const tts = buildPOITTS(curated);
          if (tts) options?.onSuggestPlaces?.(tts);
        })
        .catch((err) => {
          console.error("[maps_suggest_places] Failed to load POIs:", err);
        });
      return;
    }

    default:
      onAction?.(action);
  }
}
