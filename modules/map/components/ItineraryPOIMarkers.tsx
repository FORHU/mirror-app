"use client";

import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { createRoot, type Root } from "react-dom/client";
import { useMapStore } from "../store/useMapStore";
import { stopColor } from "../constants/stopColors";
import type { NearbyPOI } from "../services/map.service";

const POPUP_CSS = `
  .ipm-popup .mapboxgl-popup-content {
    background: transparent !important;
    padding: 0 !important;
    box-shadow: none !important;
    border-radius: 0 !important;
  }
  .ipm-popup .mapboxgl-popup-tip { display: none !important; }
`;

function walkingMin(distKm: number) {
  return Math.max(1, Math.round((distKm * 60) / 5));
}
function carMin(distKm: number) {
  return Math.max(1, Math.round((distKm * 60) / 30));
}

function POICard({
  poi,
  color,
  walkMin,
  carMins,
  onNavigate,
  onClose,
}: {
  poi: NearbyPOI;
  color: string;
  walkMin: number;
  carMins: number;
  onNavigate: () => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        width: 240,
        background: "rgba(10,10,10,0.97)",
        border: "1px solid rgba(255,255,255,0.13)",
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {poi.photo && (
        <div
          style={{
            width: "100%",
            height: 110,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={poi.photo}
            alt={poi.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to top, rgba(0,0,0,0.6), transparent 60%)",
            }}
          />
        </div>
      )}
      <div style={{ padding: "10px 12px 12px" }}>
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.6)",
            border: "1px solid rgba(255,255,255,0.15)",
            cursor: "pointer",
            color: "rgba(255,255,255,0.8)",
            fontSize: 10,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ✕
        </button>

        <div
          style={{
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 4,
            paddingRight: 24,
          }}
        >
          {poi.name}
        </div>
        <div
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.45)",
            marginBottom: 8,
          }}
        >
          {poi.category.replace(/_/g, " ")}
          {poi.rating != null && ` · ★ ${poi.rating.toFixed(1)}`}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 10,
              color: "rgba(255,255,255,0.5)",
            }}
          >
            <span>🚶</span>
            <span>{walkMin} min</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 10,
              color: "rgba(255,255,255,0.5)",
            }}
          >
            <span>🚗</span>
            <span>{carMins} min</span>
          </div>
        </div>

        <button
          onClick={onNavigate}
          style={{
            width: "100%",
            padding: "8px 0",
            background: color,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Navigate here
        </button>
      </div>
    </div>
  );
}

interface OpenPopup {
  popup: mapboxgl.Popup;
  root: Root;
}

const ItineraryPOIMarkers: React.FC<{ map: mapboxgl.Map }> = ({ map }) => {
  const itineraryStopPOIs = useMapStore((s) => s.itineraryStopPOIs);
  const itineraryStops = useMapStore((s) => s.itineraryStops);
  const setItineraryStops = useMapStore((s) => s.setItineraryStops);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const popupsRef = useRef<OpenPopup[]>([]);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = POPUP_CSS;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    popupsRef.current.forEach(({ popup, root }) => {
      popup.remove();
      setTimeout(() => root.unmount(), 0);
    });
    popupsRef.current = [];

    if (!map || itineraryStopPOIs.length === 0) return;

    itineraryStopPOIs.forEach(({ stopIndex, pois }) => {
      const color = stopColor(stopIndex);

      pois.forEach((poi: NearbyPOI) => {
        const dist = (poi.distance ?? 0) / 1000; // API returns metres; helpers expect km

        // Dot marker — tap/click opens this POI's card (one at a time, no auto-open)
        const el = document.createElement("div");
        el.innerHTML = `<div style="width:20px;height:20px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.5);cursor:pointer;" title="${poi.name}"></div>`;
        el.style.willChange = "transform";

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          // Close all existing open popups before opening this one
          popupsRef.current.forEach(({ popup, root: r }) => {
            popup.remove();
            setTimeout(() => r.unmount(), 0);
          });
          popupsRef.current = [];

          const container = document.createElement("div");
          const root = createRoot(container);

          const closeThisPopup = () => {
            const idx = popupsRef.current.findIndex((p) => p.root === root);
            if (idx !== -1) {
              const { popup, root: r } = popupsRef.current[idx];
              popup.remove();
              popupsRef.current.splice(idx, 1);
              setTimeout(() => r.unmount(), 0);
            }
          };

          root.render(
            <POICard
              poi={poi}
              color={color}
              walkMin={walkingMin(dist)}
              carMins={carMin(dist)}
              onClose={closeThisPopup}
              onNavigate={() => {
                const current = useMapStore.getState().itineraryStops;
                const branchIndex = stopIndex + 1;
                const newStop = { name: poi.name, lat: poi.lat, lng: poi.lng, address: poi.address, placeId: poi.placeId };
                const updated = [
                  ...current.slice(0, branchIndex),
                  newStop,
                  ...current.slice(branchIndex),
                ];
                setItineraryStops(updated).then(() => {
                  const poiData = useMapStore.getState().itineraryStopPOIs;
                  useMapStore.getState().setItineraryStopPOIs(
                    poiData.map((p) => p.stopIndex === branchIndex ? { ...p, pois: [] } : p),
                  );
                });
                closeThisPopup();
              }}
            />
          );

          const popup = new mapboxgl.Popup({
            offset: [0, -18],
            closeButton: false,
            closeOnClick: false,
            maxWidth: "none",
            className: "ipm-popup",
            anchor: "bottom",
          })
            .setLngLat([poi.lng, poi.lat])
            .setDOMContent(container)
            .addTo(map);

          popupsRef.current.push({ popup, root });

          // Pan map to this POI so the card is fully visible
          map.easeTo({ center: [poi.lng, poi.lat], zoom: Math.max(map.getZoom(), 14), duration: 400 });
        });

        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([poi.lng, poi.lat])
          .addTo(map);
        markersRef.current.push(marker);
      });
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      popupsRef.current.forEach(({ popup, root }) => {
        popup.remove();
        setTimeout(() => root.unmount(), 0);
      });
      popupsRef.current = [];
    };
  }, [map, itineraryStopPOIs, itineraryStops, setItineraryStops]);

  return null;
};

export default ItineraryPOIMarkers;
