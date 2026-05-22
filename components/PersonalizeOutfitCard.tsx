"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/navigation";
import { Calendar, MapPin, Sparkles } from "lucide-react";
import "../styles/personalize-outfit.css";

export default function PersonalizeOutfitCard() {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [eventType, setEventType] = useState("");

  return (
    <div
      style={{
        borderRadius: "20px",
        padding: "40px 36px",
        width: "480px",
      }}
      className="glass-card-strong neon-border-white rounded-3xl"
    >
      {/* Header */}
      <div className="text-center" style={{ marginBottom: "32px" }}>
        <h1
          style={{
            color: "white",
            fontSize: "24px",
            fontWeight: "700",
            marginBottom: "8px",
          }}
        >
          Personalize Your Look
        </h1>
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "14px" }}>
          Tell us about your event
        </p>
      </div>

      {/* When */}
      <div style={{ marginBottom: "24px" }}>
        <label
          className="flex items-center gap-2"
          style={{
            color: "white",
            fontSize: "14px",
            fontWeight: "600",
            marginBottom: "10px",
          }}
        >
          <Calendar size={15} color="white" />
          When is the event?
        </label>
        <div className="flex gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="pz-input"
            style={{ flex: 1 }}
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="pz-input"
            style={{ flex: 1 }}
          />
        </div>
      </div>

      {/* Where */}
      <div style={{ marginBottom: "24px" }}>
        <label
          className="flex items-center gap-2"
          style={{
            color: "white",
            fontSize: "14px",
            fontWeight: "600",
            marginBottom: "10px",
          }}
        >
          <MapPin size={15} color="white" />
          Where is the event?
        </label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Enter location"
          className="pz-input"
        />
      </div>

      {/* What */}
      <div style={{ marginBottom: "36px" }}>
        <label
          className="flex items-center gap-2"
          style={{
            color: "white",
            fontSize: "14px",
            fontWeight: "600",
            marginBottom: "10px",
          }}
        >
          <Sparkles size={15} color="white" />
          What is the event?
        </label>
        <select
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          className="pz-select"
        >
          <option value="" disabled>
            Select event type
          </option>
          <option value="wedding">Wedding</option>
          <option value="party">Party</option>
          <option value="business">Business</option>
          <option value="casual">Casual</option>
          <option value="formal">Formal</option>
          <option value="birthday">Birthday</option>
          <option value="date">Date Night</option>
        </select>
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          className="pz-btn-skip"
          onClick={() => router.push(ROUTES.AI_RECOMMENDATION_FASHION)}
        >
          Skip
        </button>
        <button
          className="pz-btn-continue"
          onClick={() => router.push(ROUTES.AI_RECOMMENDATION_FASHION)}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
