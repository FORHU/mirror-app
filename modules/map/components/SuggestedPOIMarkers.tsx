"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { createRoot, type Root } from "react-dom/client";
import { useMapStore } from "../store/useMapStore";
import type { NearbyPOI } from "../services/map.service";

const POPUP_CSS = `
  .spm-popup .mapboxgl-popup-content {
    background: transparent !important;
    padding: 0 !important;
    box-shadow: none !important;
    border-radius: 0 !important;
  }
  .spm-popup .mapboxgl-popup-tip { display: none !important; }
`;

const CATEGORY_COLORS: [string, string][] = [
  ["restaurant", "#f43f5e"],
  ["cafe", "#f97316"],
  ["coffee", "#f97316"],
  ["bar", "#a78bfa"],
  ["park", "#22c55e"],
  ["garden", "#22c55e"],
  ["attraction", "#3b82f6"],
  ["museum", "#60a5fa"],
  ["mall", "#a78bfa"],
  ["shop", "#a78bfa"],
  ["store", "#a78bfa"],
  ["hospital", "#fb923c"],
  ["pharmacy", "#fb923c"],
  ["medical", "#fb923c"],
  ["transit", "#3b82f6"],
  ["bus", "#3b82f6"],
  ["train", "#3b82f6"],
  ["hotel", "#facc15"],
  ["lodging", "#facc15"],
];

function poiColor(category: string): string {
  const lower = category.toLowerCase();
  for (const [key, color] of CATEGORY_COLORS) {
    if (lower.includes(key)) return color;
  }
  return "#8b5cf6";
}

function createMarkerEl(color: string): HTMLDivElement {
  const el = document.createElement("div");
  Object.assign(el.style, {
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    background: color,
    border: "2px solid rgba(255,255,255,0.8)",
    boxShadow: `0 0 8px ${color}99`,
    cursor: "pointer",
    transition: "all 0.2s ease",
    zIndex: "10",
  });
  return el;
}

function setMarkerSelected(el: HTMLDivElement, color: string, selected: boolean) {
  Object.assign(el.style, {
    width: selected ? "22px" : "16px",
    height: selected ? "22px" : "16px",
    border: selected ? "3px solid white" : "2px solid rgba(255,255,255,0.8)",
    boxShadow: selected ? `0 0 20px ${color}cc, 0 0 8px ${color}88` : `0 0 8px ${color}99`,
  });
}

function POIPopupContent({
  poi,
  onNavigate,
  onClose,
}: {
  poi: NearbyPOI;
  onNavigate: () => void;
  onClose: () => void;
}) {
  const color = poiColor(poi.category);
  const dayIndex = new Date().getDay();
  const googleDayIndex = dayIndex === 0 ? 6 : dayIndex - 1;
  const todayHours = poi.weekdayDescriptions?.[googleDayIndex]?.split(": ")[1];

  return (
    <div
      style={{
        width: 280,
        background: "rgba(10,10,10,0.97)",
        border: "1px solid rgba(255,255,255,0.13)",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Photo */}
      <div style={{ width: "100%", height: 140, overflow: "hidden", position: "relative", background: "rgba(255,255,255,0.05)" }}>
        {poi.photo ? (
          <img
            src={poi.photo}
            alt={poi.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 32, opacity: 0.4 }}>📍</span>
          </div>
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent 60%)" }} />
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 8, right: 8,
            width: 26, height: 26, borderRadius: "50%",
            background: "rgba(0,0,0,0.65)",
            border: "1px solid rgba(255,255,255,0.18)",
            cursor: "pointer", color: "rgba(255,255,255,0.8)",
            fontSize: 12, fontWeight: 700, lineHeight: 1,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: "12px 14px 14px" }}>
        {/* Category badge */}
        <span style={{
          display: "inline-block",
          background: `${color}22`, color,
          border: `1px solid ${color}44`,
          borderRadius: 20, fontSize: 10, fontWeight: 600,
          padding: "2px 8px", textTransform: "uppercase",
          letterSpacing: "0.06em", marginBottom: 6,
        }}>
          {poi.category.replace(/_/g, " ")}
        </span>

        {/* Name */}
        <div style={{ color: "#fff", fontSize: 15, fontWeight: 700, lineHeight: 1.25, marginBottom: 8 }}>
          {poi.name}
        </div>

        {/* Rating */}
        {poi.rating != null && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6, color: "#fbbf24", fontSize: 12 }}>
            <span>★</span>
            <span style={{ fontWeight: 600 }}>{poi.rating.toFixed(1)}</span>
          </div>
        )}

        {/* Distance · Address */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 5, marginBottom: 5, fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.4 }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}>📍</span>
          <span>
            {poi.distance < 1000
              ? `${Math.round(poi.distance / 10) * 10}m`
              : `${(poi.distance / 1000).toFixed(1)}km`}
            {poi.address ? ` · ${poi.address}` : ""}
          </span>
        </div>

        {/* Open status */}
        {poi.openNow != null && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5, fontSize: 11 }}>
            <span style={{ flexShrink: 0 }}>🕐</span>
            <span style={{ color: poi.openNow ? "#4ade80" : "#f87171", fontWeight: 600 }}>
              {poi.openNow ? "Open" : "Closed"}
            </span>
            {todayHours && (
              <span style={{ color: "rgba(255,255,255,0.35)" }}>· {todayHours}</span>
            )}
          </div>
        )}

        {/* Phone */}
        {poi.phone && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
            <span style={{ flexShrink: 0 }}>📞</span>
            <span>{poi.phone}</span>
          </div>
        )}

        {/* Website */}
        {poi.website && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 10, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
            <span style={{ flexShrink: 0 }}>🌐</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 210 }}>
              {poi.website.replace(/^https?:\/\/(www\.)?/, "")}
            </span>
          </div>
        )}

        {/* Navigate CTA */}
        <button
          onClick={onNavigate}
          style={{
            width: "100%", padding: "10px 0",
            background: "#2144c0", color: "#fff",
            border: "none", borderRadius: 10,
            fontSize: 13, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            cursor: "pointer",
            marginTop: !poi.website && !poi.phone && poi.openNow == null && poi.rating == null ? 4 : 0,
          }}
        >
          <span style={{ fontSize: 11 }}>▶</span>
          Navigate here
        </button>
      </div>
    </div>
  );
}

interface MarkerEntry {
  marker: mapboxgl.Marker;
  el: HTMLDivElement;
}

interface OpenEntry {
  popup: mapboxgl.Popup;
  root: Root;
  markerEl: HTMLDivElement;
  color: string;
}

export default function SuggestedPOIMarkers() {
  const { map, suggestedPOIs, setDestination, clearSuggestions } = useMapStore();
  const markersRef = useRef<MarkerEntry[]>([]);
  const openRef = useRef<OpenEntry | null>(null);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = POPUP_CSS;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  useEffect(() => {
    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current = [];
    if (openRef.current) {
      openRef.current.popup.remove();
      openRef.current.root.unmount();
      openRef.current = null;
    }

    if (!map || !suggestedPOIs.length) return;

    const nearest = suggestedPOIs.reduce((a, b) => (a.distance < b.distance ? a : b));

    const openPopup = (poi: NearbyPOI, el: HTMLDivElement) => {
      if (openRef.current) {
        openRef.current.popup.remove();
        openRef.current.root.unmount();
        setMarkerSelected(openRef.current.markerEl, openRef.current.color, false);
        openRef.current = null;
      }

      const color = poiColor(poi.category);
      setMarkerSelected(el, color, true);

      const container = document.createElement("div");
      const root = createRoot(container);

      const closePopup = () => {
        if (openRef.current) {
          openRef.current.popup.remove();
          openRef.current.root.unmount();
          setMarkerSelected(openRef.current.markerEl, openRef.current.color, false);
          openRef.current = null;
        }
      };

      root.render(
        <POIPopupContent
          poi={poi}
          onClose={closePopup}
          onNavigate={() => {
            setDestination({
              name: poi.name,
              lat: poi.lat,
              lng: poi.lng,
              address: poi.address,
              placeId: poi.placeId,
            });
            clearSuggestions();
          }}
        />,
      );

      const popup = new mapboxgl.Popup({
        offset: [0, -14],
        closeButton: false,
        closeOnClick: false,
        maxWidth: "none",
        className: "spm-popup",
      })
        .setLngLat([poi.lng, poi.lat])
        .setDOMContent(container)
        .addTo(map);

      openRef.current = { popup, root, markerEl: el, color };
    };

    suggestedPOIs.forEach((poi) => {
      const color = poiColor(poi.category);
      const el = createMarkerEl(color);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([poi.lng, poi.lat])
        .addTo(map);

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        openPopup(poi, el);
      });

      markersRef.current.push({ marker, el });

      if (poi.placeId === nearest.placeId) {
        setTimeout(() => openPopup(poi, el), 400);
      }
    });

    return () => {
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current = [];
      if (openRef.current) {
        openRef.current.popup.remove();
        openRef.current.root.unmount();
        openRef.current = null;
      }
    };
  }, [map, suggestedPOIs, setDestination, clearSuggestions]);

  return null;
}
