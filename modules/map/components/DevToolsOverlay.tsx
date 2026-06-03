"use client";

import { useState } from "react";
import { useMapStore } from "../store/useMapStore";
import { mapService } from "../services/map.service";
import type { NearbyPOI } from "../services/map.service";
import { chatWonderService } from "@/modules/shared/api/chat-wonder.service";
import { mapPlaceToNearbyPOI, buildMapInput } from "../utils/chatWonderMapUtils";

const PANEL = {
  background: "rgba(0,0,0,0.85)",
  backdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "14px",
  padding: "10px 12px",
} as const;

export default function DevToolsOverlay() {
  const [destOpen, setDestOpen] = useState(false);
  const [destInput, setDestInput] = useState("");
  const [destLoading, setDestLoading] = useState(false);
  const [destError, setDestError] = useState("");

  const [recOpen, setRecOpen] = useState(false);
  const [recInput, setRecInput] = useState("");
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState("");
  const [recReply, setRecReply] = useState("");

  async function handleSetDestination() {
    if (!destInput.trim()) return;
    setDestLoading(true);
    setDestError("");
    try {
      const map = useMapStore.getState();
      const loc = map.userLocation ?? map.homeLocation ?? undefined;
      const { results } = await mapService.geocode(destInput.trim(), loc);
      if (!results.length) {
        setDestError("No results found.");
        return;
      }
      await useMapStore.getState().setDestination(results[0]);
      setDestInput("");
      setDestOpen(false);
    } catch {
      setDestError("Geocoding failed.");
    } finally {
      setDestLoading(false);
    }
  }

  async function handleAskRecommendation() {
    if (!recInput.trim()) return;
    setRecLoading(true);
    setRecError("");
    setRecReply("");
    try {
      await chatWonderService.getSessionId();
      const map = useMapStore.getState();
      const loc = map.userLocation ?? map.homeLocation;
      const dest = map.selectedDestination;

      const res = await chatWonderService.message({
        input: buildMapInput(recInput.trim(), loc, dest, !!map.activeRoute),
      });
      setRecReply(res.message);

      const places = res.maps_data?.[0]?.places;
      if (places?.length) {
        const originLat = loc?.lat ?? 0;
        const originLng = loc?.lng ?? 0;
        const label = res.maps_data![0].query ?? recInput.trim();
        const pois: NearbyPOI[] = places.map((p) =>
          mapPlaceToNearbyPOI(p, originLat, originLng),
        );
        useMapStore.getState().setSuggestedPOIs(pois, label);
      }
    } catch (err) {
      setRecError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setRecLoading(false);
    }
  }

  return (
    <div className="absolute top-24 right-6 z-40 flex flex-col gap-2 pointer-events-auto w-64">
      {/* Set Destination */}
      <div style={PANEL}>
        <button
          onClick={() => { setDestOpen((v) => !v); setDestError(""); }}
          className="w-full flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-white/60 hover:text-white transition-colors"
        >
          <span>📍 Set Destination</span>
          <span>{destOpen ? "▲" : "▼"}</span>
        </button>
        {destOpen && (
          <div className="mt-2 flex flex-col gap-2">
            <input
              value={destInput}
              onChange={(e) => setDestInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSetDestination()}
              placeholder="e.g. SM Baguio"
              disabled={destLoading}
              className="w-full rounded-lg px-3 py-2 text-xs text-white bg-white/10 border border-white/15 outline-none placeholder:text-white/30 disabled:opacity-50"
            />
            {destError && <p className="text-[10px] text-red-400">{destError}</p>}
            <button
              onClick={handleSetDestination}
              disabled={destLoading || !destInput.trim()}
              className="w-full py-1.5 rounded-lg text-xs font-semibold text-black bg-white disabled:opacity-40 transition-opacity"
            >
              {destLoading ? "Searching…" : "Set"}
            </button>
          </div>
        )}
      </div>

      {/* Ask for Recommendations */}
      <div style={PANEL}>
        <button
          onClick={() => { setRecOpen((v) => !v); setRecError(""); setRecReply(""); }}
          className="w-full flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-white/60 hover:text-white transition-colors"
        >
          <span>🔍 Recommendations</span>
          <span>{recOpen ? "▲" : "▼"}</span>
        </button>
        {recOpen && (
          <div className="mt-2 flex flex-col gap-2">
            <input
              value={recInput}
              onChange={(e) => setRecInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAskRecommendation()}
              placeholder="e.g. recommend restaurants near me"
              disabled={recLoading}
              className="w-full rounded-lg px-3 py-2 text-xs text-white bg-white/10 border border-white/15 outline-none placeholder:text-white/30 disabled:opacity-50"
            />
            {recError && <p className="text-[10px] text-red-400">{recError}</p>}
            {recReply && (
              <p className="text-[10px] text-white/60 leading-snug">{recReply}</p>
            )}
            <button
              onClick={handleAskRecommendation}
              disabled={recLoading || !recInput.trim()}
              className="w-full py-1.5 rounded-lg text-xs font-semibold text-black bg-white disabled:opacity-40 transition-opacity"
            >
              {recLoading ? "Asking…" : "Ask"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
