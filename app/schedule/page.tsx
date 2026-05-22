"use client";

import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCalendarStore, type CalendarEvent } from "@/modules/shared/store/useCalendarStore";
import { useVoice } from "@/modules/shared/voice/useVoice";
import type { ChatWonderAction } from "@/modules/shared/ai/chatwonder.types";

const EVENT_TYPE_COLORS: Record<string, string> = {
  casual:    "#a78bfa",
  formal:    "#6366f1",
  business:  "#3b82f6",
  romantic:  "#f43f5e",
  outdoor:   "#22c55e",
  party:     "#f97316",
  sports:    "#eab308",
  other:     "#8b5cf6",
};

function formatDateTime(iso: string): { date: string; time: string } {
  try {
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
    };
  } catch {
    return { date: iso, time: "" };
  }
}

function EventCard({ event, onDelete }: { event: CalendarEvent; onDelete: () => void }) {
  const { date, time } = formatDateTime(event.dateTime);
  const color = EVENT_TYPE_COLORS[event.eventType] ?? "#8b5cf6";
  const isPast = new Date(event.dateTime) < new Date();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: isPast ? 0.45 : 1, y: 0 }}
      exit={{ opacity: 0, y: -12, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      style={{
        background: "rgba(255,255,255,0.92)",
        borderRadius: 20,
        padding: "22px 24px",
        border: `1.5px solid ${color}22`,
        boxShadow: `0 4px 24px ${color}18`,
        display: "flex",
        alignItems: "flex-start",
        gap: 18,
      }}
    >
      {/* Color dot */}
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, marginTop: 8, flexShrink: 0 }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 22, fontWeight: 700, color: "#2d2d3a", marginBottom: 4, lineHeight: 1.2 }}>
          {event.title}
        </p>
        <p style={{ fontSize: 14, color: color, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
          {event.eventType}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 16, color: "#6b5b95", fontWeight: 500 }}>
            📅 {date} · {time}
          </span>
          {event.location && (
            <span style={{ fontSize: 16, color: "#9e93c8" }}>
              📍 {event.location}
            </span>
          )}
        </div>
      </div>

      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onDelete}
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "1px solid rgba(107,91,149,0.15)",
          background: "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#c4b5fd",
          fontSize: 18,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        ×
      </motion.button>
    </motion.div>
  );
}

export default function SchedulePage() {
  const router = useRouter();
  const { events, removeEvent } = useCalendarStore();

  const [, setHighlight] = useState<string | null>(null);

  const sorted = [...events].sort(
    (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime(),
  );

  const upcoming = sorted.filter((e) => new Date(e.dateTime) >= new Date());
  const past     = sorted.filter((e) => new Date(e.dateTime) <  new Date());

  // Voice: handle calendar_query_date → highlight, calendar_clear_event → delete
  const handleVoiceAction = (action: ChatWonderAction) => {
    if (action.type === "calendar_query_date") {
      setHighlight(action.date);
    }
    if (action.type === "calendar_clear_event") {
      removeEvent(action.id);
    }
    if (action.type === "navigate") {
      router.push(action.route);
    }
  };

  useVoice(
    { route: "/schedule", pageName: "schedule", collectedData: undefined },
    handleVoiceAction,
  );

  return (
    <motion.main
      className="relative w-screen min-h-screen overflow-y-auto"
      style={{ background: "linear-gradient(135deg, #f0e6ff 0%, #fce7f3 100%)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "28px 36px 20px",
          background: "linear-gradient(180deg, rgba(240,230,255,0.98) 80%, transparent 100%)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: "#3d2f5f", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            My Schedule
          </h1>
          <p style={{ fontSize: 16, color: "#9e93c8", marginTop: 4 }}>
            {upcoming.length} upcoming · {past.length} past
          </p>
        </div>

        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => router.back()}
          style={{
            background: "rgba(167,139,250,0.12)",
            border: "1px solid rgba(167,139,250,0.25)",
            borderRadius: 14,
            padding: "10px 22px",
            fontSize: 16,
            fontWeight: 600,
            color: "#7c3aed",
            cursor: "pointer",
          }}
        >
          ← Back
        </motion.button>
      </header>

      <div style={{ padding: "0 36px 60px", maxWidth: 680, margin: "0 auto" }}>
        {events.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{ textAlign: "center", paddingTop: 80 }}
          >
            <p style={{ fontSize: 64, marginBottom: 20 }}>📭</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: "#3d2f5f", marginBottom: 10 }}>
              No events yet
            </p>
            <p style={{ fontSize: 18, color: "#9e93c8", marginBottom: 36 }}>
              Use the voice assistant during event setup to add events here.
            </p>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push("/event-setup")}
              style={{
                background: "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
                borderRadius: 16,
                padding: "18px 40px",
                fontSize: 20,
                fontWeight: 700,
                color: "white",
                border: "none",
                cursor: "pointer",
              }}
            >
              Set Up an Event
            </motion.button>
          </motion.div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <section style={{ marginBottom: 36 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#9e93c8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
                  Upcoming
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <AnimatePresence>
                    {upcoming.map((e) => (
                      <EventCard key={e.id} event={e} onDelete={() => removeEvent(e.id)} />
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#9e93c8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
                  Past
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <AnimatePresence>
                    {past.map((e) => (
                      <EventCard key={e.id} event={e} onDelete={() => removeEvent(e.id)} />
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </motion.main>
  );
}
