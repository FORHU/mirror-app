"use client";

import { useState, useRef, useEffect } from "react";
import type { RemoteGarment } from "@/modules/shared/api/garment.service";
import type { RemoteOutfit } from "@/modules/shared/api/outfit.service";
import type { OutfitPreviewCanvasHandle } from "@/components/OutfitPreviewCanvas";
import OutfitPreviewCanvas from "@/components/OutfitPreviewCanvas";
import { generateOutfit } from "@/modules/shared/api/tailor.service";
import { outfitService } from "@/modules/shared/api/outfit.service";
import { useAuthStore } from "@/modules/shared/store/useAuthStore";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";
import { useChatWonderContext } from "@/modules/shared/ai/ChatWonderProvider";

type SwapSlot = "base" | "mid" | "outer" | "bottoms" | "shoes" | "bags";

function resolveSwapSlot(
  garmentType: string[],
  fittingSlot: string[],
): SwapSlot {
  if (garmentType.includes("Bag")) return "bags";
  if (fittingSlot.includes("LowerGarment")) return "bottoms";
  if (fittingSlot.includes("FootGarment")) return "shoes";
  const t = garmentType[0] ?? "";
  if (["Blazer", "Jacket", "Coat", "Parka", "Windbreaker"].includes(t))
    return "outer";
  if (["Hoodie", "Sweater", "Cardigan", "Pullover"].includes(t)) return "mid";
  return "base";
}

export interface OutfitPreviewModalProps {
  outfitModified: boolean;
  activeOutfit: RemoteOutfit | null;
  outfitOverrides: Record<string, RemoteGarment>;
  selectedTopBase: RemoteGarment | null;
  selectedTopMid: RemoteGarment | null;
  selectedTopOuter: RemoteGarment | null;
  selectedBottom: RemoteGarment | null;
  selectedShoe: RemoteGarment | null;
  selectedBag: RemoteGarment | null;
  canvasRef: React.RefObject<OutfitPreviewCanvasHandle | null>;
  onClose: () => void;
}

export function OutfitPreviewModal({
  outfitModified,
  activeOutfit,
  outfitOverrides,
  selectedTopBase,
  selectedTopMid,
  selectedTopOuter,
  selectedBottom,
  selectedShoe,
  selectedBag,
  canvasRef,
  onClose,
}: OutfitPreviewModalProps) {
  const [view, setView] = useState<"canvas" | "result" | "save-form">("canvas");
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [saveDesc, setSaveDesc] = useState("");

  const gender = useAuthStore((s) => s.user?.gender ?? null);
  const setIsChatOpen = useMirrorStore((s) => s.setIsChatOpen);
  const chatTailorData = useMirrorStore((s) => s.chatTailorData);
  const setChatTailorData = useMirrorStore((s) => s.setChatTailorData);
  const { sendMessage } = useChatWonderContext();

  // Watch gender: if it lands while we're on the canvas view after having
  // asked for it, the button will become active automatically (no extra logic).
  const genderRef = useRef(gender);
  useEffect(() => {
    genderRef.current = gender;
  }, [gender]);

  // When stylist calls generate_outfit_image via chat, the result lands here.
  useEffect(() => {
    if (!chatTailorData) return;
    setChatTailorData(null);
    setResultUrl(chatTailorData.image_url);
    setView("result");
  }, [chatTailorData, setChatTailorData]);

  // Garment resolution (same logic as before)
  let cBase: RemoteGarment | null = selectedTopBase;
  let cMid: RemoteGarment | null = selectedTopMid;
  let cOuter: RemoteGarment | null = selectedTopOuter;
  let cBottom: RemoteGarment | null = selectedBottom;
  let cShoe: RemoteGarment | null = selectedShoe;
  let cBag: RemoteGarment | null = selectedBag;

  if (activeOutfit) {
    cBase = null;
    cMid = null;
    cOuter = null;
    cBottom = null;
    cShoe = null;
    cBag = null;
    for (const item of activeOutfit.items) {
      const eff = (outfitOverrides[item.id] ?? item.garment) as RemoteGarment;
      if (eff.garmentType?.includes("Bag")) {
        cBag = eff;
        continue;
      }
      if (item.slot === "LowerGarment") {
        cBottom = eff;
        continue;
      }
      if (item.slot === "FootGarment") {
        cShoe = eff;
        continue;
      }
      if (item.slot === "UpperGarment") {
        const layer = resolveSwapSlot(
          eff.garmentType ?? [],
          eff.fittingSlot ?? [],
        );
        if (layer === "outer") cOuter = eff;
        else if (layer === "mid") cMid = eff;
        else cBase = eff;
      }
    }
  }

  async function handleGenerate() {
    if (!gender) {
      // No gender — send garment URLs so stylist can call generate_outfit_image
      // immediately after the user provides their gender in chat.
      const garmentUrls = [cBase, cMid, cOuter, cBottom, cShoe, cBag]
        .filter((g): g is RemoteGarment => !!g?.imageUrl)
        .map((g) => g.imageUrl);
      const annotation =
        garmentUrls.length > 0
          ? `[GARMENT_IMAGES:${JSON.stringify(garmentUrls)}] `
          : "";
      setIsChatOpen(true);
      void sendMessage(`${annotation}I'd like to generate my outfit.`);
      return;
    }

    setGenError(null);
    setIsGenerating(true);
    try {
      const blob = await canvasRef.current?.getBlob();
      if (!blob) throw new Error("Could not capture canvas");
      const tailorGender: "MALE" | "FEMALE" =
        gender === "MALE" ? "MALE" : "FEMALE";
      const result = await generateOutfit(blob, tailorGender);
      setResultUrl(result.image_url);
      setView("result");
    } catch (e) {
      setGenError((e as Error).message ?? "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSave() {
    if (!resultUrl || isSaved || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(
        `/api/proxy-image?url=${encodeURIComponent(resultUrl)}`,
      );
      const pngBlob = res.ok ? await res.blob() : null;

      const items = [
        cBase && { garmentId: cBase.id, slot: "UpperGarment" },
        cMid && { garmentId: cMid.id, slot: "UpperGarment" },
        cOuter && { garmentId: cOuter.id, slot: "UpperGarment" },
        cBottom && { garmentId: cBottom.id, slot: "LowerGarment" },
        cShoe && { garmentId: cShoe.id, slot: "FootGarment" },
        cBag && { garmentId: cBag.id, slot: "RightHandAccessory" },
      ].filter(Boolean) as { garmentId: string; slot: string }[];

      const defaultName = activeOutfit?.name
        ? `${activeOutfit.name} — Custom`
        : `My Look — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
      const name = saveName.trim() || defaultName;
      const description = saveDesc.trim() || undefined;

      await outfitService.create({ name, description, items, pngBlob });
      setIsSaved(true);
      setView("result");
    } catch (e) {
      setSaveError((e as Error).message ?? "Failed to save outfit");
    } finally {
      setIsSaving(false);
    }
  }

  const canGenerate = !!gender && !isGenerating;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.7)",
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
          borderRadius: "20px",
          padding: "24px 20px",
          width: "360px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {(view === "result" || view === "save-form") && (
            <button
              onClick={() =>
                setView(view === "save-form" ? "result" : "canvas")
              }
              style={{
                background: "none",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 8,
                color: "white",
                fontSize: 13,
                padding: "4px 10px",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              ← {view === "save-form" ? "Back" : "Edit"}
            </button>
          )}
          <p
            style={{
              color: "white",
              fontSize: "20px",
              fontWeight: "700",
              textAlign: "center",
              margin: 0,
              flex: 1,
            }}
          >
            {view === "result"
              ? "Generated Outfit"
              : view === "save-form"
                ? "Save Wardrobe"
                : outfitModified
                  ? "Customized Look"
                  : "Your Look"}
          </p>
        </div>

        {/* Canvas view */}
        {view === "canvas" && (
          <>
            <div
              style={{
                width: "100%",
                aspectRatio: "2/3",
                borderRadius: "12px",
                overflow: "hidden",
                background: "#1a1a1a",
              }}
            >
              <OutfitPreviewCanvas
                ref={canvasRef}
                topBase={cBase}
                topMid={cMid}
                topOuter={cOuter}
                bottom={cBottom}
                shoe={cShoe}
                bag={cBag}
              />
            </div>

            {genError && (
              <p
                style={{
                  color: "#f87171",
                  fontSize: 12,
                  margin: 0,
                  textAlign: "center",
                }}
              >
                {genError}
              </p>
            )}

            {!gender && (
              <p
                style={{
                  color: "rgba(255,255,255,0.45)",
                  fontSize: 12,
                  margin: 0,
                  textAlign: "center",
                }}
              >
                Tap Generate — Miraj will ask for your gender first.
              </p>
            )}

            <button
              disabled={!canGenerate && !!gender}
              onClick={handleGenerate}
              style={{
                width: "100%",
                padding: "12px",
                background: isGenerating ? "rgba(255,255,255,0.15)" : "#ffffff",
                border: "none",
                borderRadius: "12px",
                color: isGenerating ? "rgba(255,255,255,0.5)" : "#000",
                fontSize: "15px",
                fontWeight: "700",
                cursor: isGenerating ? "not-allowed" : "pointer",
                opacity: isGenerating ? 0.7 : 1,
              }}
            >
              {isGenerating
                ? "Generating…"
                : !gender
                  ? "Generate Outfit"
                  : "Generate Outfit"}
            </button>

            <button
              style={{
                width: "100%",
                padding: "12px",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "12px",
                color: "rgba(255,255,255,0.7)",
                fontSize: "15px",
                fontWeight: "600",
                cursor: "pointer",
              }}
              onClick={onClose}
            >
              Done
            </button>
          </>
        )}

        {/* Save form view */}
        {view === "save-form" && (
          <>
            <div
              style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                  }}
                >
                  Name
                </label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="e.g. Summer Casual"
                  maxLength={80}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 10,
                    color: "white",
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                  }}
                >
                  Description (optional)
                </label>
                <textarea
                  value={saveDesc}
                  onChange={(e) => setSaveDesc(e.target.value)}
                  placeholder="Brief description of this wardrobe…"
                  rows={3}
                  maxLength={200}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 10,
                    color: "white",
                    fontSize: 14,
                    outline: "none",
                    resize: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {saveError && (
                <p
                  style={{
                    color: "#f87171",
                    fontSize: 12,
                    margin: 0,
                    textAlign: "center",
                  }}
                >
                  {saveError}
                </p>
              )}
            </div>

            <button
              disabled={isSaving}
              onClick={handleSave}
              style={{
                width: "100%",
                padding: "12px",
                background: isSaving ? "rgba(255,255,255,0.15)" : "#ffffff",
                border: "none",
                borderRadius: "12px",
                color: isSaving ? "rgba(255,255,255,0.5)" : "#000",
                fontSize: "15px",
                fontWeight: "700",
                cursor: isSaving ? "not-allowed" : "pointer",
                opacity: isSaving ? 0.7 : 1,
              }}
            >
              {isSaving ? "Saving…" : "Save Wardrobe"}
            </button>

            <button
              style={{
                width: "100%",
                padding: "12px",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "12px",
                color: "rgba(255,255,255,0.7)",
                fontSize: "15px",
                fontWeight: "600",
                cursor: "pointer",
              }}
              onClick={onClose}
            >
              Cancel
            </button>
          </>
        )}

        {/* Result view */}
        {view === "result" && resultUrl && (
          <>
            <div
              style={{
                width: "100%",
                aspectRatio: "2/3",
                borderRadius: "12px",
                overflow: "hidden",
                background: "#1a1a1a",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resultUrl}
                alt="Generated outfit"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>

            {saveError && (
              <p
                style={{
                  color: "#f87171",
                  fontSize: 12,
                  margin: 0,
                  textAlign: "center",
                }}
              >
                {saveError}
              </p>
            )}

            <button
              disabled={isSaved}
              onClick={() => {
                if (!isSaved) {
                  setSaveName("");
                  setSaveDesc("");
                  setSaveError(null);
                  setView("save-form");
                }
              }}
              style={{
                width: "100%",
                padding: "12px",
                background: isSaved ? "rgba(255,255,255,0.15)" : "#ffffff",
                border: isSaved ? "1px solid rgba(255,255,255,0.2)" : "none",
                borderRadius: "12px",
                color: isSaved ? "rgba(255,255,255,0.7)" : "#000",
                fontSize: "15px",
                fontWeight: "700",
                cursor: isSaved ? "default" : "pointer",
              }}
            >
              {isSaved ? "Saved ✓" : "Save Outfit"}
            </button>

            <button
              style={{
                width: "100%",
                padding: "12px",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "12px",
                color: "rgba(255,255,255,0.7)",
                fontSize: "15px",
                fontWeight: "600",
                cursor: "pointer",
              }}
              onClick={onClose}
            >
              Done
            </button>
          </>
        )}
      </div>
    </div>
  );
}
