"use client";

import { useRef, useState } from "react";
import {
  Menu,
  ArrowLeft,
  X,
  Shirt,
  Layers,
  Footprints,
  Watch,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/navigation";
import { LucideIcon } from "lucide-react";
import "../../styles/glow.css";
import {
  garmentService,
  type RemoteGarment,
} from "@/modules/shared/api/garment.service";
import { FittingSlot } from "@/modules/garment/types";

type Category = {
  name: string;
  path: string;
  icon: LucideIcon;
  slots: FittingSlot[];
  available: boolean;
};

const categories: Category[] = [
  {
    name: "Tops",
    path: "upper-garment",
    icon: Shirt,
    slots: [FittingSlot.UpperGarment, FittingSlot.FullGarment],
    available: true,
  },
  {
    name: "Bottoms",
    path: "lower-garment",
    icon: Layers,
    slots: [FittingSlot.LowerGarment],
    available: true,
  },
  {
    name: "Footwear",
    path: "footwear",
    icon: Footprints,
    slots: [FittingSlot.FootGarment],
    available: true,
  },
  {
    name: "Accessories",
    path: "accessories",
    icon: Watch,
    slots: [
      FittingSlot.HeadGarment,
      FittingSlot.Glasses,
      FittingSlot.Earrings,
      FittingSlot.LeftHandAccessory,
      FittingSlot.RightHandAccessory,
      FittingSlot.NeckAccessory,
      FittingSlot.WaistAccessory,
    ],
    available: true,
  },
  {
    name: "Full Outfit",
    path: "full-outfit",
    icon: Sparkles,
    slots: [],
    available: false,
  },
];

export default function VirtualMirror() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [garments, setGarments] = useState<RemoteGarment[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedGarmentId, setSelectedGarmentId] = useState<string | null>(
    null,
  );
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [detailGarment, setDetailGarment] = useState<RemoteGarment | null>(
    null,
  );

  const garmentTypes = Array.from(
    new Set(garments.flatMap((g) => g.garmentType).filter(Boolean)),
  );
  const visibleGarments = selectedType
    ? garments.filter((g) => g.garmentType.includes(selectedType))
    : garments;

  async function selectCategory(category: Category) {
    if (!category.available) return;
    setIsMenuOpen(false);
    setActiveCategory(category);
    setSelectedGarmentId(null);
    setSelectedType(null);
    setGarments([]);
    setLoading(true);
    try {
      const results = await Promise.all(
        category.slots.map((s) => garmentService.getBySlot(s)),
      );
      setGarments(results.flat());
    } catch {
      setGarments([]);
    } finally {
      setLoading(false);
    }
  }

  // useEffect(() => {
  //   async function startCamera() {
  //     try {
  //       const stream = await navigator.mediaDevices.getUserMedia({
  //         video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } },
  //       });
  //       streamRef.current = stream;
  //       if (videoRef.current) videoRef.current.srcObject = stream;
  //     } catch {
  //       // camera unavailable — mirror shows black
  //     }
  //   }
  //   startCamera();
  //   return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  // }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {/* Full-bleed mirrored camera */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Header — floats over the camera */}
      <header
        className={`absolute top-0 inset-x-0 z-20 flex items-center justify-between shrink-0 py-4 px-4 transition-opacity duration-300 ${isMenuOpen || activeCategory ? "opacity-0 pointer-events-none" : "opacity-100"}`}
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 100%)",
        }}
      >
        <button
          onClick={() => setIsMenuOpen(true)}
          className="p-4 transition-all hover:scale-105 active:scale-95"
        >
          <Menu className="w-6 h-6 text-white" />
        </button>
        <span className="text-white font-semibold text-3xl tracking-wide select-none">
          Virtual Mirror
        </span>
        <button
          onClick={() => router.push(ROUTES.LOGGED_IN)}
          className="p-4 transition-all hover:scale-105 active:scale-95"
        >
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
      </header>

      {/* Sidebar overlay */}
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${isMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      >
        <div
          className="absolute inset-0 bg-black/20"
          onClick={() => setIsMenuOpen(false)}
        />

        <div
          className={`absolute top-0 left-0 h-full w-[384px] transition-all duration-300 ease-out ${isMenuOpen ? "translate-x-0" : "-translate-x-full"}`}
          style={{
            background: "rgba(255,255,255,0.18)",
            backdropFilter: "blur(5px)",
            borderRight: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          <div className="flex flex-col h-full w-full p-6">
            <div className="flex items-center justify-between mb-8 mt-14">
              <h3 className="text-white text-2xl font-semibold">Menu</h3>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="transition-all hover:scale-110 active:scale-95"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>

            <div className="flex-1 flex flex-col overflow-y-auto">
              {categories.map((category, i) => {
                const Icon = category.icon;
                return (
                  <button
                    key={category.path}
                    onClick={() => selectCategory(category)}
                    disabled={!category.available}
                    className={`flex items-center gap-4 px-2 py-5 text-left transition-all active:scale-95 ${i !== 0 ? "border-t border-white/10" : ""} ${category.available ? "hover:bg-white/10" : "opacity-35 cursor-not-allowed"}`}
                  >
                    <Icon
                      className="w-6 h-6 text-white/60 shrink-0"
                      strokeWidth={1.5}
                    />
                    <span className="text-white font-medium text-lg">
                      {category.name}
                    </span>
                    {!category.available && (
                      <span className="ml-auto text-white/30 text-xs">
                        Soon
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-white/10">
              <p className="text-white/30 text-sm text-center">
                Select a category
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Category full-screen overlay */}
      <div
        className={`absolute inset-0 z-40 flex flex-col transition-opacity duration-300 ${activeCategory && !detailGarment ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        style={{ background: "rgba(0,0,0,0.55)" }}
      >
        {/* Top bar */}
        <div
          className="flex items-center justify-between shrink-0 py-4 px-4"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)",
          }}
        >
          <button
            onClick={() => setActiveCategory(null)}
            className="p-4 transition-all hover:scale-105 active:scale-95"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <span className="text-white font-semibold text-3xl tracking-wide select-none">
            {activeCategory?.name}
          </span>
          <div className="w-14" />
        </div>

        {/* Garment grid */}
        <div className="flex-1 overflow-y-auto px-6 pb-8">
          {/* Type filter chips */}
          {!loading && garmentTypes.length > 0 && (
            <div className="flex gap-2 flex-wrap pt-5 pb-1">
              <button
                onClick={() => setSelectedType(null)}
                style={{
                  padding: "6px 16px",
                  borderRadius: "999px",
                  fontSize: "13px",
                  fontWeight: 500,
                  border:
                    selectedType === null
                      ? "1.5px solid white"
                      : "1.5px solid rgba(255,255,255,0.25)",
                  background:
                    selectedType === null
                      ? "rgba(255,255,255,0.15)"
                      : "transparent",
                  color: "white",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                All
              </button>
              {garmentTypes.map((type) => (
                <button
                  key={type}
                  onClick={() =>
                    setSelectedType(selectedType === type ? null : type)
                  }
                  style={{
                    padding: "6px 16px",
                    borderRadius: "999px",
                    fontSize: "13px",
                    fontWeight: 500,
                    border:
                      selectedType === type
                        ? "1.5px solid white"
                        : "1.5px solid rgba(255,255,255,0.25)",
                    background:
                      selectedType === type
                        ? "rgba(255,255,255,0.15)"
                        : "transparent",
                    color: "white",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    whiteSpace: "nowrap",
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-12 h-12 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          ) : garments.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-white/30 text-xl">No garments found</p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "16px",
                paddingTop: "24px",
              }}
            >
              {visibleGarments.map((garment) => {
                const isSelected = selectedGarmentId === garment.id;
                return (
                  <button
                    key={garment.id}
                    onClick={() => {
                      setSelectedGarmentId(garment.id);
                      setDetailGarment(garment);
                    }}
                    style={{
                      aspectRatio: "3/4",
                      borderRadius: "12px",
                      overflow: "hidden",
                      background: "transparent",
                      display: "block",
                      border: isSelected
                        ? "2.5px solid white"
                        : "2.5px solid transparent",
                      transform: isSelected ? "scale(1.04)" : "scale(1)",
                      transition: "border-color 0.15s, transform 0.15s",
                      outline: "none",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={garment.imageUrl}
                      alt={garment.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Garment detail overlay */}
      <div
        className={`absolute inset-0 z-50 flex flex-col transition-opacity duration-300 ${detailGarment ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        style={{ background: "rgba(0,0,0,0.55)" }}
      >
        {/* Top bar — same design as category header */}
        <div
          className="flex items-center justify-between shrink-0 py-4 px-4"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)",
          }}
        >
          <button
            onClick={() => setDetailGarment(null)}
            className="p-4 transition-all hover:scale-105 active:scale-95"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <div className="w-14" />
        </div>

        {detailGarment && (
          <div className="flex flex-1 min-h-0 px-10 gap-6">
            {/* Left — image, name, description */}
            <div
              className="w-2 shrink-0 flex flex-col overflow-y-auto pt-4 gap-4"
              style={{ height: "356px", width: "400px" }}
            >
              {detailGarment.name && (
                <p className="text-white font-semibold text-xl leading-snug shrink-0">
                  {detailGarment.name.replace(/^"+|"+$/g, "")}
                </p>
              )}
              {detailGarment.description && (
                <p className="text-white/55 text-sm leading-relaxed shrink-0">
                  {detailGarment.description.replace(/^"+|"+$/g, "")}
                </p>
              )}
              <div
                className="flex flex-row items-center justify-center"
                style={{ width: "400px", height: "250px" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={detailGarment.imageUrl}
                  alt={detailGarment.name}
                  style={{
                    width: "100%",
                    maxHeight: "100%",
                    objectFit: "contain",
                    borderRadius: "16px",
                    flexShrink: 0,
                  }}
                />
              </div>
            </div>

            {/* Right — type, category, tags */}
            <div
              className="w-1/5 overflow-y-auto flex flex-col pt-4 pb-10 gap-6"
              style={{ height: "356px" }}
            >
              {/* Garment type */}
              {detailGarment.garmentType.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-white/40 text-xs uppercase tracking-widest">
                    Type
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {detailGarment.garmentType.map((t) => (
                      <span
                        key={t}
                        style={{
                          padding: "4px 14px",
                          borderRadius: "999px",
                          fontSize: "13px",
                          fontWeight: 500,
                          border: "1.5px solid rgba(255,255,255,0.3)",
                          color: "white",
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Category */}
              {detailGarment.category.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-white/40 text-xs uppercase tracking-widest">
                    Category
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {detailGarment.category.map((c) => (
                      <span
                        key={c}
                        style={{
                          padding: "4px 14px",
                          borderRadius: "999px",
                          fontSize: "13px",
                          fontWeight: 500,
                          border: "1.5px solid rgba(255,255,255,0.3)",
                          color: "white",
                        }}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {detailGarment.tags?.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-white/40 text-xs uppercase tracking-widest">
                    Tags
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {detailGarment.tags.map((tag) => (
                      <span
                        key={tag.id}
                        style={{
                          padding: "4px 14px",
                          borderRadius: "999px",
                          fontSize: "13px",
                          border: "1.5px solid rgba(255,255,255,0.15)",
                          color: "rgba(255,255,255,0.55)",
                        }}
                      >
                        #{tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
