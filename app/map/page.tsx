"use client";

import { useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { MapDashboard, MAP_PROMPT_KEY } from "@/modules/map";
import { useMapStore } from "@/modules/map/store/useMapStore";
import { mapService } from "@/modules/map/services/map.service";
// import HomeLocationSetup from "@/modules/map/components/HomeLocationSetup";
import { useVoice } from "@/modules/shared/voice/useVoice";
import { useVoiceContext } from "@/modules/shared/voice/VoiceProvider";
import MirrorHeader from "@/components/MirrorHeader";
import { ChatNavLoader } from "@/components/ChatNavLoader";
import { QuickResponseChips } from "@/components/QuickResponseChips";

async function consumePendingLocation() {
  try {
    const raw = sessionStorage.getItem("mirror_pending_map_location");
    if (!raw) return;
    sessionStorage.removeItem("mirror_pending_map_location");

    const { query, label } = JSON.parse(raw) as {
      query: string;
      label: string;
    };
    const store = useMapStore.getState();
    const userLoc = store.userLocation ?? store.homeLocation ?? undefined;
    const { results } = await mapService.geocode(query, userLoc);
    if (!results.length) return;

    useMapStore.setState({
      selectedDestination: { ...results[0], name: label || results[0].name },
      activeRoute: null,
      isSearching: false,
      searchResults: [],
    });
  } catch {}
}

async function consumePendingDirections() {
  try {
    const raw = sessionStorage.getItem("mirror_pending_map_directions");
    if (!raw) return;
    sessionStorage.removeItem("mirror_pending_map_directions");

    const { destination } = JSON.parse(raw) as { destination: string };
    const store = useMapStore.getState();
    const userLoc = store.userLocation ?? store.homeLocation ?? undefined;
    const { results } = await mapService.geocode(destination, userLoc);
    if (!results.length) return;

    await useMapStore.getState().setDestination(results[0]);
  } catch {}
}

export default function MapPage() {
  const {
    homeLocation,
    homeLocationStatus,
    loadHomeLocation,
    loadOutlineStops,
  } = useMapStore();
  const router = useRouter();
  const onAction = useCallback(() => {}, []);
  const { submitText } = useVoiceContext();

  useVoice(
    {
      route: "/map",
      pageName: "Map",
      activeStep: "exploring",
      mode: "map",
    },
    onAction,
  );

  // Read the handoff prompt on mount and store in a ref.
  // We intentionally do NOT call submitText here — we wait until homeLocation
  // has settled so that geocoding runs with proximity bias and route fetching
  // starts from the user's home location rather than {lat:0,lng:0}.
  const handoffFiredRef = useRef(false);
  const handoffPromptRef = useRef<string | null>(null);
  useEffect(() => {
    const prompt = sessionStorage.getItem(MAP_PROMPT_KEY);
    if (!prompt) return;
    sessionStorage.removeItem(MAP_PROMPT_KEY);
    handoffPromptRef.current = prompt;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadHomeLocation();
  }, [loadHomeLocation]);

  useEffect(() => {
    if (homeLocationStatus !== "loaded" || homeLocation === null) return;
    consumePendingLocation();
    consumePendingDirections();
    loadOutlineStops();
  }, [homeLocationStatus, homeLocation, loadOutlineStops]);

  // Fire the handoff prompt once location loading settles (loaded or error).
  // At this point homeLocation is in the map store, so geocoding will use it
  // as a proximity hint and setItineraryStops will route from the right origin.
  useEffect(() => {
    if (homeLocationStatus === "idle" || homeLocationStatus === "loading")
      return;
    if (handoffFiredRef.current || !handoffPromptRef.current) return;
    handoffFiredRef.current = true;
    const prompt = handoffPromptRef.current;
    handoffPromptRef.current = null;
    void submitText(prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeLocationStatus]);

  if (homeLocationStatus === "idle" || homeLocationStatus === "loading") {
    return (
      <div className="fixed inset-0 bg-canvas flex flex-col items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/80 animate-spin mb-6" />
        <p className="text-white/50 text-sm font-light tracking-wide">
          Setting up your map…
        </p>
      </div>
    );
  }

  // if (homeLocationStatus === "error") {
  //   return (
  //     <div className="fixed inset-0 bg-[#000000] flex flex-col items-center justify-center text-white p-4">
  //       <p className="mb-4 text-white/70">Failed to load system state</p>
  //       <button
  //         onClick={() => loadHomeLocation()}
  //         className="px-6 py-2 border border-white/20 rounded-full hover:bg-white/10 transition-colors"
  //       >
  //         Retry
  //       </button>
  //     </div>
  //   );
  // }

  // if (homeLocationStatus === "loaded" && homeLocation === null) {
  //   return <HomeLocationSetup />;
  // }

  return (
    <main className="w-screen h-dvh bg-canvas relative overflow-hidden">
      <ChatNavLoader />

      {/* Header — weather left, time center, back right */}
      <MirrorHeader
        className="absolute top-0 inset-x-0 z-50"
        onBack={() => router.back()}
      />

      <MapDashboard />

      {/* Quick Response Chips — absolute so map-library GPU transforms can't trap it.
          bottom-28 (112px) clears the fixed mic (bottom-6 + 64px tall = top at 88px). */}
      <div className="absolute bottom-28 left-0 right-0 z-30 pointer-events-none">
        <div className="pointer-events-auto">
          <QuickResponseChips
            prompts={[
              "Show me restaurants and cafes near me.",
              "Show me popular spots and attractions near me.",
              "Show me the fastest route from my current location to the nearest mall.",
              "Show me a pharmacy near me.",
              "Show me the nearest grocery or convenience store.",
            ]}
          />
        </div>
      </div>
    </main>
  );
}
