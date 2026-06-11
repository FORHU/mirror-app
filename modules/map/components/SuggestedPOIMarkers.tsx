"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { createRoot, type Root } from "react-dom/client";
import { useMapStore } from "../store/useMapStore";
import type { NearbyPOI } from "../services/map.service";

// ─── Popup styles ─────────────────────────────────────────────────────────────

const POPUP_CSS = `
  .spm-popup .mapboxgl-popup-content {
    background: transparent !important;
    padding: 0 !important;
    box-shadow: none !important;
    border-radius: 0 !important;
  }
  .spm-popup .mapboxgl-popup-tip { display: none !important; }
  .spm-popup { z-index: 25 !important; }
`;

// ─── Category colours ─────────────────────────────────────────────────────────

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

// ─── Pin element ──────────────────────────────────────────────────────────────
// anchor="bottom" → Mapbox aligns the BOTTOM of this element to the coordinate.
// The element is a circle with a centred triangle tail pointing downward, so
// the very tip of the tail sits exactly on the lat/lng at all zoom levels.

function createPinEl(color: string): HTMLDivElement {
  const wrapper = document.createElement("div");
  Object.assign(wrapper.style, {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    cursor: "pointer",
    willChange: "transform", // GPU compositor layer — Mapbox repositions on every frame
    filter: `drop-shadow(0 2px 6px ${color}99)`,
    transition: "filter 0.2s ease, transform 0.15s ease",
  });

  // Circle head
  const head = document.createElement("div");
  Object.assign(head.style, {
    width: "22px",
    height: "22px",
    borderRadius: "50%",
    background: color,
    border: "2.5px solid #fff",
    boxSizing: "border-box",
    flexShrink: "0",
  });

  // Triangle tail — pure CSS, no image
  const tail = document.createElement("div");
  Object.assign(tail.style, {
    width: "0",
    height: "0",
    borderLeft: "5px solid transparent",
    borderRight: "5px solid transparent",
    borderTop: `8px solid ${color}`,
    marginTop: "-1px", // close the gap between head and tail
    flexShrink: "0",
  });

  wrapper.appendChild(head);
  wrapper.appendChild(tail);
  return wrapper;
}

function setPinSelected(
  wrapper: HTMLDivElement,
  color: string,
  selected: boolean,
) {
  const head = wrapper.firstElementChild as HTMLDivElement | null;
  if (head) {
    Object.assign(head.style, {
      width: selected ? "28px" : "22px",
      height: selected ? "28px" : "22px",
      border: selected ? "3px solid #fff" : "2.5px solid #fff",
    });
  }
  Object.assign(wrapper.style, {
    filter: selected
      ? `drop-shadow(0 0 12px ${color}cc) drop-shadow(0 2px 8px ${color}88)`
      : `drop-shadow(0 2px 6px ${color}99)`,
    transform: selected ? "scale(1.15)" : "scale(1)",
    zIndex: selected ? "20" : "10",
  });
  // Raise the Mapbox-generated .mapboxgl-marker container above the popup
  // (.mapboxgl-popup default z-index is 3; markers default to 0 and hide behind it).
  if (wrapper.parentElement) {
    wrapper.parentElement.style.zIndex = selected ? "20" : "5";
  }
}

// ─── Popup content (React component) ─────────────────────────────────────────

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
      <div
        style={{
          width: "100%",
          height: 140,
          overflow: "hidden",
          position: "relative",
          background: "rgba(255,255,255,0.05)",
        }}
      >
        {poi.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poi.photo}
            alt={poi.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: `${color}18`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 32, opacity: 0.4 }}>📍</span>
          </div>
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(0,0,0,0.55), transparent 60%)",
          }}
        />
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.65)",
            border: "1px solid rgba(255,255,255,0.18)",
            cursor: "pointer",
            color: "rgba(255,255,255,0.8)",
            fontSize: 12,
            fontWeight: 700,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: "12px 14px 14px" }}>
        <span
          style={{
            display: "inline-block",
            background: `${color}22`,
            color,
            border: `1px solid ${color}44`,
            borderRadius: 20,
            fontSize: 10,
            fontWeight: 600,
            padding: "2px 8px",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 6,
          }}
        >
          {poi.category.replace(/_/g, " ")}
        </span>

        <div
          style={{
            color: "#fff",
            fontSize: 15,
            fontWeight: 700,
            lineHeight: 1.25,
            marginBottom: 8,
          }}
        >
          {poi.name}
        </div>

        {poi.rating != null && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              marginBottom: 6,
              color: "#fbbf24",
              fontSize: 12,
            }}
          >
            <span>★</span>
            <span style={{ fontWeight: 600 }}>{poi.rating.toFixed(1)}</span>
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 5,
            marginBottom: 5,
            fontSize: 11,
            color: "rgba(255,255,255,0.5)",
            lineHeight: 1.4,
          }}
        >
          <span style={{ flexShrink: 0, marginTop: 1 }}>📍</span>
          <span>
            {poi.distance < 1
              ? `${Math.round(poi.distance * 1000)}m`
              : `${poi.distance.toFixed(1)}km`}
            {poi.address ? ` · ${poi.address}` : ""}
          </span>
        </div>

        {poi.openNow != null && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              marginBottom: 5,
              fontSize: 11,
            }}
          >
            <span style={{ flexShrink: 0 }}>🕐</span>
            <span
              style={{
                color: poi.openNow ? "#4ade80" : "#f87171",
                fontWeight: 600,
              }}
            >
              {poi.openNow ? "Open" : "Closed"}
            </span>
            {todayHours && (
              <span style={{ color: "rgba(255,255,255,0.35)" }}>
                · {todayHours}
              </span>
            )}
          </div>
        )}

        {poi.phone && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              marginBottom: 5,
              fontSize: 11,
              color: "rgba(255,255,255,0.5)",
            }}
          >
            <span style={{ flexShrink: 0 }}>📞</span>
            <span>{poi.phone}</span>
          </div>
        )}

        {poi.website && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              marginBottom: 10,
              fontSize: 11,
              color: "rgba(255,255,255,0.5)",
            }}
          >
            <span style={{ flexShrink: 0 }}>🌐</span>
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 210,
              }}
            >
              {poi.website.replace(/^https?:\/\/(www\.)?/, "")}
            </span>
          </div>
        )}

        <button
          onClick={onNavigate}
          style={{
            width: "100%",
            padding: "10px 0",
            background: "#2144c0",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            cursor: "pointer",
            marginTop:
              !poi.website &&
              !poi.phone &&
              poi.openNow == null &&
              poi.rating == null
                ? 4
                : 0,
          }}
        >
          <span style={{ fontSize: 11 }}>▶</span>
          Navigate here
        </button>
      </div>
    </div>
  );
}

// ─── Internal refs ────────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function SuggestedPOIMarkers() {
  const { map, suggestedPOIs, setDestination, clearSuggestions } =
    useMapStore();
  const markersRef = useRef<MarkerEntry[]>([]);
  const openRef = useRef<OpenEntry | null>(null);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = POPUP_CSS;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    // Clean up previous markers
    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current = [];
    if (openRef.current) {
      openRef.current.popup.remove();
      const staleRoot = openRef.current.root;
      openRef.current = null;
      setTimeout(() => staleRoot.unmount(), 0);
    }

    if (!map || !suggestedPOIs.length) return;

    const openPopup = (poi: NearbyPOI, el: HTMLDivElement) => {
      if (openRef.current) {
        openRef.current.popup.remove();
        const staleRoot = openRef.current.root;
        setPinSelected(openRef.current.markerEl, openRef.current.color, false);
        openRef.current = null;
        setTimeout(() => staleRoot.unmount(), 0);
      }

      const color = poiColor(poi.category);
      setPinSelected(el, color, true);

      const container = document.createElement("div");
      const root = createRoot(container);

      const closePopup = () => {
        if (openRef.current) {
          openRef.current.popup.remove();
          const staleRoot = openRef.current.root;
          setPinSelected(
            openRef.current.markerEl,
            openRef.current.color,
            false,
          );
          openRef.current = null;
          setTimeout(() => staleRoot.unmount(), 0);
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

      // Offset popup above the full pin height (head 28px + tail 8px) + a gap

      // Save camera state BEFORE addTo triggers Mapbox's auto-pan.
      // Mapbox schedules the easeTo on the NEXT requestAnimationFrame, not
      // synchronously, so map.stop() called here would fire before the animation
      // has started and cancel nothing.  We restore in the RAF callback instead.
      const savedCenter = map.getCenter();
      const savedZoom = map.getZoom();
      const savedBearing = map.getBearing();
      const savedPitch = map.getPitch();

      const popup = new mapboxgl.Popup({
        offset: [0, -44],
        closeButton: false,
        closeOnClick: false,
        maxWidth: "none",
        className: "spm-popup",
      })
        .setLngLat([poi.lng, poi.lat])
        .setDOMContent(container)
        .addTo(map);

      // On the next frame the auto-pan easeTo has started — cancel it and
      // jump back to the original position so other pins stay in view.
      requestAnimationFrame(() => {
        map.stop();
        map.jumpTo({
          center: savedCenter,
          zoom: savedZoom,
          bearing: savedBearing,
          pitch: savedPitch,
        });
      });

      openRef.current = { popup, root, markerEl: el, color };
    };

    suggestedPOIs.forEach((poi) => {
      const color = poiColor(poi.category);
      const el = createPinEl(color);

      // anchor="bottom" → the bottom tip of the pin element aligns exactly with
      // the coordinate. Mapbox recalculates CSS transform on every pan/zoom frame.
      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([poi.lng, poi.lat])
        .addTo(map);

      // Raise the .mapboxgl-marker container above the popup overlay
      // (.mapboxgl-popup z-index: 3, markers default to 0).
      if (el.parentElement) el.parentElement.style.zIndex = "5";

      // Stop pointerdown so Mapbox GL JS v3 never synthesizes a map click
      // from this interaction (it listens on the container for pointerdown).
      el.addEventListener("pointerdown", (e) => e.stopPropagation());
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        openPopup(poi, el);
      });

      markersRef.current.push({ marker, el });
    });

    return () => {
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current = [];
      if (openRef.current) {
        openRef.current.popup.remove();
        const staleRoot = openRef.current.root;
        openRef.current = null;
        setTimeout(() => staleRoot.unmount(), 0);
      }
    };
  }, [map, suggestedPOIs, setDestination, clearSuggestions]);

  return null;
}
