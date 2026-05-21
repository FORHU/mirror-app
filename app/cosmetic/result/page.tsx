"use client";

import { useEffect, useState, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import "../../../styles/glow.css";
import WeatherWidget from '@/components/WeatherWidget';
import { garmentService } from '@/modules/shared/api/garment.service';
import { FittingSlot } from '@/modules/garment/types';

// ── Demo data ─────────────────────────────────────────────────────────────────
const DEMO_PRODUCTS = [
  {
    id: 1, name: "Hydra Boost Serum",    brand: "CeraVe",           use: "AM / PM",   category: "Serum",
    ingredients: ["Hyaluronic Acid", "Ceramides", "Niacinamide"],
    why: ["Targets your 68% hydration gap", "Non-greasy for combination skin", "Calms enlarged pores"],
  },
  {
    id: 2, name: "Gentle Foaming Wash",  brand: "La Roche-Posay",   use: "AM / PM",   category: "Cleanser",
    ingredients: ["Thermal Spring Water", "Niacinamide", "Glycerin"],
    why: ["Cleans without over-drying T-zone", "Maintains barrier for combination skin", "Reduces shine without stripping"],
  },
  {
    id: 3, name: "Niacinamide 10%",      brand: "The Ordinary",     use: "PM",        category: "Treatment",
    ingredients: ["Niacinamide 10%", "Zinc 1%"],
    why: ["Visibly minimises enlarged pores", "Evens out uneven skin tone", "Regulates sebum on oily areas"],
  },
  {
    id: 4, name: "Daily SPF 50+",        brand: "Altruist",         use: "AM",        category: "Sunscreen",
    ingredients: ["Uvinul A Plus", "Tinosorb S", "Tinosorb M"],
    why: ["Prevents fine line deepening", "Protects uneven tone from worsening", "Lightweight for combination skin"],
  },
  {
    id: 5, name: "Barrier Repair Cream", brand: "First Aid Beauty",  use: "PM",       category: "Moisturiser",
    ingredients: ["Colloidal Oatmeal", "Allantoin", "Ceramide 3"],
    why: ["Repairs mild dehydration overnight", "Soothes low-sensitivity skin", "Balances dry patches"],
  },
  {
    id: 6, name: "AHA 30% + BHA 2%",    brand: "The Ordinary",     use: "2× / week", category: "Exfoliant",
    ingredients: ["Glycolic Acid", "Lactic Acid", "Salicylic Acid"],
    why: ["Unclogs enlarged pores", "Smooths fine lines over time", "Brightens uneven skin tone"],
  },
];

const DEMO_SKIN = {
  skinType: "Combination",
  skinTone: { label: "Warm Medium", hex: "#C8956C" },
  hydration: 68,
  oiliness: 52,
  concerns: [
    { label: "Mild dehydration",  severity: "low"    },
    { label: "Enlarged pores",    severity: "medium" },
    { label: "Uneven skin tone",  severity: "low"    },
  ],
};

const SEVERITY_COLOR: Record<string, string> = {
  low:    "rgba(250,204,21,0.85)",
  medium: "rgba(251,146,60,0.85)",
  high:   "rgba(248,113,113,0.85)",
};

const PRODUCT_PAGE_SIZE = 6;

// ── Helpers ───────────────────────────────────────────────────────────────────
function SectionTitle({ label }: { label: string }) {
    return (
        <div className="flex items-center gap-2 px-1 py-1">
            <div className="flex-1 h-px bg-white/20" />
            <span className="text-white text-xs font-bold tracking-widest uppercase">{label}</span>
            <div className="flex-1 h-px bg-white/20" />
        </div>
    );
}

function useClock() {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);
    return now;
}

function useSwipe(onLeft: () => void, onRight: () => void) {
    const startX = useRef<number | null>(null);
    return {
        onTouchStart: (e: React.TouchEvent) => { startX.current = e.touches[0].clientX; },
        onTouchEnd: (e: React.TouchEvent) => {
            if (startX.current === null) return;
            const delta = e.changedTouches[0].clientX - startX.current;
            startX.current = null;
            if (delta < -40) onLeft();
            else if (delta > 40) onRight();
        },
        onMouseDown: (e: React.MouseEvent) => { startX.current = e.clientX; },
        onMouseUp: (e: React.MouseEvent) => {
            if (startX.current === null) return;
            const delta = e.clientX - startX.current;
            startX.current = null;
            if (delta < -40) onLeft();
            else if (delta > 40) onRight();
        },
        onMouseLeave: () => { startX.current = null; },
    };
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CosmeticResultPage() {
    const router = useRouter();
    const now = useClock();
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [productPage, setProductPage] = useState(0);
    const [garmentImages, setGarmentImages] = useState<string[]>([]);

    useEffect(() => {
        try {
            const img = sessionStorage.getItem("skin_capture");
            if (img) setCapturedImage(img);
        } catch {}
    }, []);

    useEffect(() => {
        garmentService.getBySlot(FittingSlot.UpperGarment)
            .then((garments) => setGarmentImages(garments.slice(0, DEMO_PRODUCTS.length).map((g) => g.imageUrl)))
            .catch(() => {});
    }, []);

    const totalProductPages = Math.ceil(DEMO_PRODUCTS.length / PRODUCT_PAGE_SIZE);
    const pagedProducts = DEMO_PRODUCTS.slice(productPage * PRODUCT_PAGE_SIZE, (productPage + 1) * PRODUCT_PAGE_SIZE);

    const productSwipe = useSwipe(
        () => setProductPage((p) => Math.min(p + 1, totalProductPages - 1)),
        () => setProductPage((p) => Math.max(p - 1, 0)),
    );

    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const day  = now.toLocaleDateString([], { weekday: 'long' });
    const date = now.toLocaleDateString([], { month: 'long', day: 'numeric' });

    return (
    <div className="relative w-screen h-screen overflow-hidden bg-black flex flex-col">

        {/* Header — 25/50/25 columns */}
        <header className="flex items-center shrink-0 py-4 px-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
            <div style={{ flex: '0 0 25%', width: '25%', display: 'flex', alignItems: 'center' }}>
                <WeatherWidget iconSize={32} />
            </div>
            <div style={{ flex: '0 0 50%', width: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span className="text-white font-thin select-none" style={{ fontSize: '2rem', lineHeight: 1 }}>{time}</span>
                <span className="text-white/60 text-sm font-light select-none">{day}, {date}</span>
            </div>
            <div style={{ flex: '0 0 25%', width: '25%', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => router.push('/logged-in')} className="p-4 transition-all hover:scale-105 active:scale-95">
                    <ArrowLeft className="w-6 h-6 text-white" />
                </button>
            </div>
        </header>

        {/* Body — 3 columns */}
        <div className="flex flex-1" style={{ height: '546px', minHeight: 0 }}>

            {/* Left panel — Captured photo + Skin Analysis */}
                <div className="h-full flex flex-col p-2 gap-2 min-h-0" style={{flex: '0 0 30%', width: '30%',}}>

                {/* Captured photo — fixed 9:16 portrait ratio */}
                <div
                    style={{
                    width: '100%',
                    aspectRatio: '9 / 16',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.10)',
                    background: 'rgba(255,255,255,0.04)',
                    flexShrink: 0,
                    position: 'relative',
                    }}
                >
                    {capturedImage ? (
                    <img
                        src={capturedImage}
                        alt="Skin capture"
                        style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'center top',
                        transform: 'scaleX(-1)',
                        display: 'block',
                        position: 'absolute',
                        inset: 0,
                        }}
                    />
                    ) : (
                    <div
                        style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        }}
                    >
                        <span
                        style={{
                            color: 'rgba(255,255,255,0.2)',
                            fontSize: '11px',
                        }}
                        >
                        No capture
                        </span>
                    </div>
                    )}
                </div>

                {/* Skin Analysis — compact, bottom 40% */}
                <div style={{ flex: 2, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '7px', overflow: 'hidden', padding: '2px 4px' }}>

                    {/* Skin type + tone */}
                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ color: 'white', fontSize: '11px', fontWeight: 600 }}>{DEMO_SKIN.skinType} Skin</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: DEMO_SKIN.skinTone.hex, border: '1px solid rgba(255,255,255,0.25)', flexShrink: 0 }} />
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px' }}>{DEMO_SKIN.skinTone.label}</span>
                        </div>
                    </div>

                    {/* Hydration bar */}
                    <div style={{ flexShrink: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Hydration</span>
                            <span style={{ color: 'rgba(96,165,250,0.9)', fontSize: '8px', fontWeight: 700 }}>{DEMO_SKIN.hydration}%</span>
                        </div>
                        <div style={{ height: '3px', borderRadius: '9999px', background: 'rgba(255,255,255,0.1)' }}>
                            <div style={{ height: '100%', borderRadius: '9999px', background: 'rgba(96,165,250,0.85)', width: `${DEMO_SKIN.hydration}%` }} />
                        </div>
                    </div>

                    {/* Oiliness bar */}
                    <div style={{ flexShrink: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Oiliness</span>
                            <span style={{ color: 'rgba(251,146,60,0.9)', fontSize: '8px', fontWeight: 700 }}>{DEMO_SKIN.oiliness}%</span>
                        </div>
                        <div style={{ height: '3px', borderRadius: '9999px', background: 'rgba(255,255,255,0.1)' }}>
                            <div style={{ height: '100%', borderRadius: '9999px', background: 'rgba(251,146,60,0.85)', width: `${DEMO_SKIN.oiliness}%` }} />
                        </div>
                    </div>

                    {/* Concerns */}
                    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Concerns</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '5px' }}>
                            {DEMO_SKIN.concerns.map((c) => (
                                <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: SEVERITY_COLOR[c.severity], flexShrink: 0 }} />
                                    <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '9px' }}>{c.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>

            {/* Center panel — empty mirror space */}
            <div style={{ flex: '0 0 40%', width: '40%', minHeight: 0 }} />

            {/* Right panel — Paged product list */}
            <div className="h-full flex flex-col p-2 gap-1 min-h-0" style={{ flex: '0 0 30%', width: '30%' }}>
                <SectionTitle label="Products" />

                {/* Swipeable product list */}
                <div
                    {...productSwipe}
                    style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '6px', overflow: 'hidden', touchAction: 'pan-y', userSelect: 'none', cursor: 'grab' }}
                >
                    {pagedProducts.map((product, localIdx) => {
                        const globalIdx = productPage * PRODUCT_PAGE_SIZE + localIdx;
                        const imgUrl = garmentImages[globalIdx];
                        return (
                            <div
                                key={product.id}
                                className="flex glass-card-garment"
                                style={{ flex: 1, minHeight: 0, borderRadius: '10px', overflow: 'hidden', alignItems: 'stretch' }}
                            >
                                {/* Left — photo 40% */}
                                <div style={{ flex: '0 0 40%', background: 'rgba(255,255,255,0.01)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                    {imgUrl
                                        ? <img src={imgUrl} alt={product.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />
                                        : <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '9px' }}>Photo</span>
                                    }
                                </div>

                                {/* Right — text 60% */}
                                <div style={{ flex: 1, minWidth: 0, padding: '8px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px', overflow: 'hidden' }}>
                                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                                        {product.category} · {product.use}
                                    </span>
                                    <span style={{ color: 'white', fontSize: '10px', fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                        {product.name}
                                    </span>
                                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                        {product.brand}
                                    </span>
                                    {/* Ingredient pills */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                                        {product.ingredients.map((ing) => (
                                            <span key={ing} style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.65)', fontSize: '7px', borderRadius: '9999px', padding: '1px 5px' }}>
                                                {ing}
                                            </span>
                                        ))}
                                    </div>
                                    {/* Why checkmarks — top 2 */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                        {product.why.slice(0, 2).map((reason) => (
                                            <div key={reason} style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '7px', flexShrink: 0, paddingTop: '1px' }}>✓</span>
                                                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '7px', lineHeight: 1.35, overflow: 'hidden' }}>{reason}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Dot indicator — only when multiple pages */}
                {totalProductPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px', paddingBottom: '2px', flexShrink: 0 }}>
                        {Array.from({ length: totalProductPages }).map((_, i) => (
                            <div
                                key={i}
                                onClick={() => setProductPage(i)}
                                style={{
                                    width:        i === productPage ? '14px' : '5px',
                                    height:       '5px',
                                    borderRadius: '9999px',
                                    background:   i === productPage ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.2)',
                                    transition:   'all 0.3s ease',
                                    cursor:       'pointer',
                                    flexShrink:   0,
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

        </div>
    </div>
    );
}
