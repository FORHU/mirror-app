"use client";

import { useRef, useState } from "react";
import type { RemoteGarment } from "@/modules/shared/api/garment.service";
import type { OutfitPreviewCanvasHandle } from "@/components/OutfitPreviewCanvas";
import OutfitPreviewCanvas from "@/components/OutfitPreviewCanvas";
import { outfitService } from "@/modules/shared/api/outfit.service";

interface WardrobeFormModalProps {
  selectedTopBase: RemoteGarment | null;
  selectedTopMid: RemoteGarment | null;
  selectedTopOuter: RemoteGarment | null;
  selectedBottom: RemoteGarment | null;
  selectedShoe: RemoteGarment | null;
  selectedBag: RemoteGarment | null;
  onClose: () => void;
  onSaved?: () => void;
}

export function WardrobeFormModal({
  selectedTopBase,
  selectedTopMid,
  selectedTopOuter,
  selectedBottom,
  selectedShoe,
  selectedBag,
  onClose,
  onSaved,
}: WardrobeFormModalProps) {
  const canvasRef = useRef<OutfitPreviewCanvasHandle | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 10,
    color: "white",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  };

  async function handleSave() {
    if (!name.trim()) {
      setError("Please enter a name for your wardrobe.");
      return;
    }
    if (isSaving || isSaved) return;
    setIsSaving(true);
    setError(null);
    try {
      const blob = await canvasRef.current?.getBlob();
      const items = [
        selectedTopBase && { garmentId: selectedTopBase.id, slot: "UpperGarment" },
        selectedTopMid && { garmentId: selectedTopMid.id, slot: "UpperGarment" },
        selectedTopOuter && { garmentId: selectedTopOuter.id, slot: "UpperGarment" },
        selectedBottom && { garmentId: selectedBottom.id, slot: "LowerGarment" },
        selectedShoe && { garmentId: selectedShoe.id, slot: "FootGarment" },
        selectedBag && { garmentId: selectedBag.id, slot: "RightHandAccessory" },
      ].filter(Boolean) as { garmentId: string; slot: string }[];

      await outfitService.create({
        name: name.trim(),
        description: description.trim() || undefined,
        items,
        pngBlob: blob ?? null,
      });
      setIsSaved(true);
      onSaved?.();
    } catch (e) {
      setError((e as Error).message ?? "Failed to save wardrobe");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#111",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 20,
          padding: "20px 20px 16px",
          width: 360,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <p
            style={{
              color: "white",
              fontSize: 18,
              fontWeight: 700,
              margin: 0,
              flex: 1,
              textAlign: "center",
            }}
          >
            Create Wardrobe
          </p>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8,
              color: "rgba(255,255,255,0.5)",
              fontSize: 13,
              padding: "4px 10px",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Outfit formation canvas — fixed height so it doesn't push form out of view */}
        <div
          style={{
            width: "100%",
            height: 220,
            flexShrink: 0,
            borderRadius: 12,
            overflow: "hidden",
            background: "#1a1a1a",
          }}
        >
          <OutfitPreviewCanvas
            ref={canvasRef}
            topBase={selectedTopBase}
            topMid={selectedTopMid}
            topOuter={selectedTopOuter}
            bottom={selectedBottom}
            shoe={selectedShoe}
            bag={selectedBag}
          />
        </div>

        {/* Form fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={labelStyle}>Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Summer Casual"
              maxLength={80}
              style={inputStyle}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={labelStyle}>Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description…"
              rows={2}
              maxLength={200}
              style={{ ...inputStyle, resize: "none" }}
            />
          </div>
        </div>

        {error && (
          <p style={{ color: "#f87171", fontSize: 12, margin: 0, textAlign: "center" }}>
            {error}
          </p>
        )}

        {/* Actions */}
        <button
          disabled={isSaving || isSaved}
          onClick={handleSave}
          style={{
            width: "100%",
            padding: "12px",
            background: isSaved
              ? "rgba(255,255,255,0.15)"
              : isSaving
                ? "rgba(255,255,255,0.15)"
                : "#ffffff",
            border: isSaved ? "1px solid rgba(255,255,255,0.2)" : "none",
            borderRadius: 12,
            color: isSaved || isSaving ? "rgba(255,255,255,0.6)" : "#000",
            fontSize: 15,
            fontWeight: 700,
            cursor: isSaving || isSaved ? "default" : "pointer",
            opacity: isSaving ? 0.7 : 1,
          }}
        >
          {isSaving ? "Saving…" : isSaved ? "Saved ✓" : "Save Wardrobe"}
        </button>

        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: "12px",
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 12,
            color: "rgba(255,255,255,0.7)",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
