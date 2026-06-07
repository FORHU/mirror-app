"use client";

import React from "react";
import { useMapStore } from "../store/useMapStore";
import { stopColor } from "../constants/stopColors";
import type { NearbyPOI } from "../services/map.service";
import Image from "next/image";

const ItineraryPOIPanel: React.FC = () => {
  const itineraryStopPOIs = useMapStore((s) => s.itineraryStopPOIs);
  const itineraryStops = useMapStore((s) => s.itineraryStops);
  const setItineraryStops = useMapStore((s) => s.setItineraryStops);
  const setItineraryStopPOIs = useMapStore((s) => s.setItineraryStopPOIs);

  const groups = itineraryStopPOIs
    .filter(({ pois }) => pois.length > 0)
    .map(({ stopIndex, pois }) => ({
      stopIndex,
      stop: itineraryStops[stopIndex],
      pois: pois.slice(0, 3),
      color: stopColor(stopIndex),
    }))
    .filter(({ stop }) => !!stop);

  if (groups.length === 0) return null;

  const handleNavigate = (poi: NearbyPOI, stopIndex: number) => {
    const current = useMapStore.getState().itineraryStops;
    const branchIndex = stopIndex + 1;
    const newStop = {
      name: poi.name,
      lat: poi.lat,
      lng: poi.lng,
      address: poi.address,
      placeId: poi.placeId,
    };
    const updated = [
      ...current.slice(0, branchIndex),
      newStop,
      ...current.slice(branchIndex),
    ];
    setItineraryStops(updated).then(() => {
      const poiData = useMapStore.getState().itineraryStopPOIs;
      setItineraryStopPOIs(
        poiData.map((p) =>
          p.stopIndex === branchIndex ? { ...p, pois: [] } : p,
        ),
      );
    });
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 96,
        left: 12,
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "auto",
      }}
    >
      {groups.map(({ stopIndex, stop, pois, color }) => (
        <div
          key={stopIndex}
          style={{
            background: "rgba(10,10,10,0.9)",
            border: `2px solid ${color}`,
            borderRadius: 14,
            overflow: "hidden",
            width: 270,
            backdropFilter: "blur(14px)",
            boxShadow: `0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px ${color}20`,
          }}
        >
          {/* Stop header */}
          <div
            style={{
              padding: "7px 10px",
              borderBottom: `1px solid ${color}40`,
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: color,
                flexShrink: 0,
                boxShadow: `0 0 6px ${color}`,
              }}
            />
            <span
              style={{
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.04em",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
              }}
            >
              {stop.name}
            </span>
          </div>

          {/* POI rows — top 3 only */}
          {pois.map((poi, i) => (
            <button
              key={poi.placeId ?? poi.name}
              onClick={() => handleNavigate(poi, stopIndex)}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 0,
                padding: "0 8px 8px",
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: "none",
                borderBottom:
                  i < pois.length - 1
                    ? "1px solid rgba(255,255,255,0.06)"
                    : "none",
                cursor: "pointer",
              }}
            >
              {/* Full-width photo above text */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: "100%",
                }}
              >
                {poi.photo ? (
                  <Image
                    src={poi.photo}
                    alt=""
                    width={300}
                    height={90}
                    unoptimized
                    style={{
                      width: "100%",
                      height: 90,
                      objectFit: "cover",
                      display: "block",
                      borderRadius: "6px 6px 0 0",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: 90,
                      borderRadius: "6px 6px 0 0",
                      background: `${color}18`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 28,
                    }}
                  >
                    📍
                  </div>
                )}

                {/* Name row below photo */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "6px 2px 2px",
                  }}
                >
                  {/* Ordinal badge */}
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: color,
                      color: "#000",
                      fontSize: 10,
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span
                    style={{
                      color: "rgba(255,255,255,0.9)",
                      fontSize: 12,
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontWeight: 600,
                    }}
                  >
                    {poi.name}
                  </span>
                  {poi.rating != null && (
                    <span
                      style={{
                        color: "#FBBF24",
                        fontSize: 11,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      ★{poi.rating.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
};

export default ItineraryPOIPanel;
