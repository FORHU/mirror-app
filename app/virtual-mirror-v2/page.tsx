"use client";

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import "../../styles/glow.css";
import { garmentService, type RemoteGarment } from '@/modules/shared/api/garment.service';
import { FittingSlot } from '@/modules/garment/types';

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

export default function VirtualMirrorV2() {
    const router = useRouter();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const now = useClock();
    const pageSize = 12;
    const accessoryPageSize = 6;

    const [tops, setTops] = useState<RemoteGarment[]>([]);
    const [topsPage, setTopsPage] = useState(0);
    const totalTopsPages = Math.ceil(tops.length / pageSize);
    const pagedTops = tops.slice(topsPage * pageSize, (topsPage + 1) * pageSize);
    const topsSwipe = useSwipe(
        () => setTopsPage((p) => Math.min(p + 1, totalTopsPages - 1)),
        () => setTopsPage((p) => Math.max(p - 1, 0)),
    );

    const [shoes, setShoes] = useState<RemoteGarment[]>([]);
    const [shoesPage, setShoesPage] = useState(0);
    const totalShoesPages = Math.ceil(shoes.length / pageSize);
    const pagedShoes = shoes.slice(shoesPage * pageSize, (shoesPage + 1) * pageSize);
    const shoesSwipe = useSwipe(
        () => setShoesPage((p) => Math.min(p + 1, totalShoesPages - 1)),
        () => setShoesPage((p) => Math.max(p - 1, 0)),
    );

    const [bottoms, setBottoms] = useState<RemoteGarment[]>([]);
    const [bottomsPage, setBottomsPage] = useState(0);
    const totalBottomsPages = Math.ceil(bottoms.length / pageSize);
    const pagedBottoms = bottoms.slice(bottomsPage * pageSize, (bottomsPage + 1) * pageSize);
    const bottomsSwipe = useSwipe(
        () => setBottomsPage((p) => Math.min(p + 1, totalBottomsPages - 1)),
        () => setBottomsPage((p) => Math.max(p - 1, 0)),
    );

    const [headGarments,     setHeadGarments]     = useState<RemoteGarment[]>([]);
    const [glasses,          setGlasses]          = useState<RemoteGarment[]>([]);
    const [earrings,         setEarrings]         = useState<RemoteGarment[]>([]);
    const [neckAccessories,  setNeckAccessories]  = useState<RemoteGarment[]>([]);
    const [waistAccessories, setWaistAccessories] = useState<RemoteGarment[]>([]);
    const [handAccessories,  setHandAccessories]  = useState<RemoteGarment[]>([]);

    const [headGarmentsPage, setHeadGarmentsPage] = useState(0);
    const totalHeadGarmentsPages = Math.ceil(headGarments.length / accessoryPageSize);
    const pagedHeadGarments = headGarments.slice(headGarmentsPage * accessoryPageSize, (headGarmentsPage + 1) * accessoryPageSize);
    const headSwipe = useSwipe(
        () => setHeadGarmentsPage((p) => Math.min(p + 1, totalHeadGarmentsPages - 1)),
        () => setHeadGarmentsPage((p) => Math.max(p - 1, 0)),
    );

    const [glassesPage, setGlassesPage] = useState(0);
    const totalGlassesPages = Math.ceil(glasses.length / accessoryPageSize);
    const pagedGlasses = glasses.slice(glassesPage * accessoryPageSize, (glassesPage + 1) * accessoryPageSize);
    const glassesSwipe = useSwipe(
        () => setGlassesPage((p) => Math.min(p + 1, totalGlassesPages - 1)),
        () => setGlassesPage((p) => Math.max(p - 1, 0)),
    );

    const [earringsPage, setEarringsPage] = useState(0);
    const totalEarringsPages = Math.ceil(earrings.length / accessoryPageSize);
    const pagedEarrings = earrings.slice(earringsPage * accessoryPageSize, (earringsPage + 1) * accessoryPageSize);
    const earringsSwipe = useSwipe(
        () => setEarringsPage((p) => Math.min(p + 1, totalEarringsPages - 1)),
        () => setEarringsPage((p) => Math.max(p - 1, 0)),
    );

    const [neckPage, setNeckPage] = useState(0);
    const totalNeckPages = Math.ceil(neckAccessories.length / accessoryPageSize);
    const pagedNeck = neckAccessories.slice(neckPage * accessoryPageSize, (neckPage + 1) * accessoryPageSize);
    const neckSwipe = useSwipe(
        () => setNeckPage((p) => Math.min(p + 1, totalNeckPages - 1)),
        () => setNeckPage((p) => Math.max(p - 1, 0)),
    );

    const [waistPage, setWaistPage] = useState(0);
    const totalWaistPages = Math.ceil(waistAccessories.length / accessoryPageSize);
    const pagedWaist = waistAccessories.slice(waistPage * accessoryPageSize, (waistPage + 1) * accessoryPageSize);
    const waistSwipe = useSwipe(
        () => setWaistPage((p) => Math.min(p + 1, totalWaistPages - 1)),
        () => setWaistPage((p) => Math.max(p - 1, 0)),
    );

    const [handPage, setHandPage] = useState(0);
    const totalHandPages = Math.ceil(handAccessories.length / accessoryPageSize);
    const pagedHand = handAccessories.slice(handPage * accessoryPageSize, (handPage + 1) * accessoryPageSize);
    const handSwipe = useSwipe(
        () => setHandPage((p) => Math.min(p + 1, totalHandPages - 1)),
        () => setHandPage((p) => Math.max(p - 1, 0)),
    );

    useEffect(() => {
        garmentService.getBySlot(FittingSlot.UpperGarment)
            .then((items) => setTops(items))
            .catch((err) => console.error('[Tops] fetch error:', err));
        garmentService.getBySlot(FittingSlot.LowerGarment)
            .then((items) => setBottoms(items))
            .catch((err) => console.error('[Bottoms] fetch error:', err));
        garmentService.getBySlot(FittingSlot.FootGarment)
            .then((items) => setShoes(items))
            .catch((err) => console.error('[Shoes] fetch error:', err));
        garmentService.getBySlot(FittingSlot.HeadGarment)
            .then(setHeadGarments)
            .catch((err) => console.error('[HeadGarment] fetch error:', err));
        garmentService.getBySlot(FittingSlot.Glasses)
            .then(setGlasses)
            .catch((err) => console.error('[Glasses] fetch error:', err));
        garmentService.getBySlot(FittingSlot.Earrings)
            .then(setEarrings)
            .catch((err) => console.error('[Earrings] fetch error:', err));
        garmentService.getBySlot(FittingSlot.NeckAccessory)
            .then(setNeckAccessories)
            .catch((err) => console.error('[NeckAccessory] fetch error:', err));
        garmentService.getBySlot(FittingSlot.WaistAccessory)
            .then(setWaistAccessories)
            .catch((err) => console.error('[WaistAccessory] fetch error:', err));
        garmentService.getBySlot(FittingSlot.RightHandAccessory)
            .then(setHandAccessories)
            .catch((err) => console.error('[HandAccessory] fetch error:', err));
    }, []);

    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const day  = now.toLocaleDateString([], { weekday: 'long' });
    const date = now.toLocaleDateString([], { month: 'long', day: 'numeric' });

    return (
    <div className="relative w-screen h-screen overflow-hidden bg-black flex flex-col">
        <header
            className={'flex items-center justify-between shrink-0 py-4 px-4'}
            style={{ background: 'rgba(0,0,0,0.85)' }}
        >
            <button onClick={() => setIsMenuOpen(true)} className="p-4 transition-all hover:scale-105 active:scale-95">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                    <path d="M12 4a2 2 0 0 1 2 2v.5L20.5 14H3.5L10 6.5V6a2 2 0 0 1 2-2z" />
                    <line x1="3" y1="14" x2="21" y2="14" />
                    <path d="M3 14c0 3 1.5 5 9 5s9-2 9-5" />
                </svg>
            </button>
            <span className="text-white font-semibold text-3xl tracking-wide select-none">Virtual Mirror</span>
            <button onClick={() => router.push('/logged-in')} className="p-4 transition-all hover:scale-105 active:scale-95">
                <ArrowLeft className="w-6 h-6 text-white" />
            </button>
        </header>
        <div className="flex flex-1" style={{ height: '546px'}}>
            {/* Left panel — Accessories */}
            <div className="flex-1 h-full flex flex-col p-2 gap-2 min-h-0">
                <div className="flex flex-col gap-1">
                    <SectionTitle label="Accessories" />

                    <div {...headSwipe} style={{ touchAction: 'pan-y', userSelect: 'none', cursor: 'grab' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                            {Array.from({ length: accessoryPageSize }).map((_, i) => {
                                const g = pagedHeadGarments[i];
                                return (
                                    <div key={i} className="rounded-md overflow-hidden flex items-center justify-center" style={{ aspectRatio: '1/1', borderRadius: '4px' }}>
                                        {g?.imageUrl && <img src={g.imageUrl} alt={g.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />}
                                    </div>
                                );
                            })}
                        </div>
                        {totalHeadGarmentsPages > 1 && (
                            <div className="flex justify-center gap-1.5 pt-2">
                                {Array.from({ length: totalHeadGarmentsPages }).map((_, i) => (
                                    <div key={i} className="rounded-full transition-all duration-300" style={{ width: i === headGarmentsPage ? 20 : 6, height: 6, background: i === headGarmentsPage ? 'white' : 'rgba(255,255,255,0.3)' }} />
                                ))}
                            </div>
                        )}
                    </div>

                    <div {...glassesSwipe} style={{ touchAction: 'pan-y', userSelect: 'none', cursor: 'grab' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                            {Array.from({ length: accessoryPageSize }).map((_, i) => {
                                const g = pagedGlasses[i];
                                return (
                                    <div key={i} className="rounded-md overflow-hidden flex items-center justify-center" style={{ aspectRatio: '1/1', borderRadius: '4px' }}>
                                        {g?.imageUrl && <img src={g.imageUrl} alt={g.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />}
                                    </div>
                                );
                            })}
                        </div>
                        {totalGlassesPages > 1 && (
                            <div className="flex justify-center gap-1.5 pt-2">
                                {Array.from({ length: totalGlassesPages }).map((_, i) => (
                                    <div key={i} className="rounded-full transition-all duration-300" style={{ width: i === glassesPage ? 20 : 6, height: 6, background: i === glassesPage ? 'white' : 'rgba(255,255,255,0.3)' }} />
                                ))}
                            </div>
                        )}
                    </div>

                    <div {...earringsSwipe} style={{ touchAction: 'pan-y', userSelect: 'none', cursor: 'grab' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                            {Array.from({ length: accessoryPageSize }).map((_, i) => {
                                const g = pagedEarrings[i];
                                return (
                                    <div key={i} className="rounded-md overflow-hidden flex items-center justify-center" style={{ aspectRatio: '1/1', borderRadius: '4px' }}>
                                        {g?.imageUrl && <img src={g.imageUrl} alt={g.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />}
                                    </div>
                                );
                            })}
                        </div>
                        {totalEarringsPages > 1 && (
                            <div className="flex justify-center gap-1.5 pt-2">
                                {Array.from({ length: totalEarringsPages }).map((_, i) => (
                                    <div key={i} className="rounded-full transition-all duration-300" style={{ width: i === earringsPage ? 20 : 6, height: 6, background: i === earringsPage ? 'white' : 'rgba(255,255,255,0.3)' }} />
                                ))}
                            </div>
                        )}
                    </div>

                    <div {...neckSwipe} style={{ touchAction: 'pan-y', userSelect: 'none', cursor: 'grab' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                            {Array.from({ length: accessoryPageSize }).map((_, i) => {
                                const g = pagedNeck[i];
                                return (
                                    <div key={i} className="rounded-md overflow-hidden flex items-center justify-center" style={{ aspectRatio: '1/1', borderRadius: '4px' }}>
                                        {g?.imageUrl && <img src={g.imageUrl} alt={g.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />}
                                    </div>
                                );
                            })}
                        </div>
                        {totalNeckPages > 1 && (
                            <div className="flex justify-center gap-1.5 pt-2">
                                {Array.from({ length: totalNeckPages }).map((_, i) => (
                                    <div key={i} className="rounded-full transition-all duration-300" style={{ width: i === neckPage ? 20 : 6, height: 6, background: i === neckPage ? 'white' : 'rgba(255,255,255,0.3)' }} />
                                ))}
                            </div>
                        )}
                    </div>

                    <div {...waistSwipe} style={{ touchAction: 'pan-y', userSelect: 'none', cursor: 'grab' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                            {Array.from({ length: accessoryPageSize }).map((_, i) => {
                                const g = pagedWaist[i];
                                return (
                                    <div key={i} className="rounded-md overflow-hidden flex items-center justify-center" style={{ aspectRatio: '1/1', borderRadius: '4px' }}>
                                        {g?.imageUrl && <img src={g.imageUrl} alt={g.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />}
                                    </div>
                                );
                            })}
                        </div>
                        {totalWaistPages > 1 && (
                            <div className="flex justify-center gap-1.5 pt-2">
                                {Array.from({ length: totalWaistPages }).map((_, i) => (
                                    <div key={i} className="rounded-full transition-all duration-300" style={{ width: i === waistPage ? 20 : 6, height: 6, background: i === waistPage ? 'white' : 'rgba(255,255,255,0.3)' }} />
                                ))}
                            </div>
                        )}
                    </div>

                    <div {...handSwipe} style={{ touchAction: 'pan-y', userSelect: 'none', cursor: 'grab' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                            {Array.from({ length: accessoryPageSize }).map((_, i) => {
                                const g = pagedHand[i];
                                return (
                                    <div key={i} className="rounded-md overflow-hidden flex items-center justify-center" style={{ aspectRatio: '1/1', borderRadius: '4px' }}>
                                        {g?.imageUrl && <img src={g.imageUrl} alt={g.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />}
                                    </div>
                                );
                            })}
                        </div>
                        {totalHandPages > 1 && (
                            <div className="flex justify-center gap-1.5 pt-2">
                                {Array.from({ length: totalHandPages }).map((_, i) => (
                                    <div key={i} className="rounded-full transition-all duration-300" style={{ width: i === handPage ? 20 : 6, height: 6, background: i === handPage ? 'white' : 'rgba(255,255,255,0.3)' }} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Center panel */}
            <div className="flex-1 h-full flex flex-col items-center justify-start pt-8 gap-1">
                <span className="text-white font-thin select-none" style={{ fontSize: '3rem', lineHeight: 1 }}>{time}</span>
                <span className="text-white/80 text-xl font-light select-none mb-4">{day}, {date}</span>
                <div className="flex gap-2 mt-3">
                </div>
            </div>

            {/* Right panel — Tops / Bottoms / Shoes */}
            <div className="flex-1 h-full flex flex-col p-2 gap-2 min-h-0">
                <div className="flex flex-col gap-1">
                    <SectionTitle label="Tops" />
                    <div {...topsSwipe} style={{ touchAction: 'pan-y', userSelect: 'none', cursor: 'grab' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                            {Array.from({ length: pageSize }).map((_, i) => {
                                const g = pagedTops[i];
                                return (
                                    <div key={i} className="rounded-md overflow-hidden flex items-center justify-center" style={{ aspectRatio: '1/1', borderRadius: '4px'}}>
                                        {g?.imageUrl && <img src={g.imageUrl} alt={g.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />}
                                    </div>
                                );
                            })}
                        </div>
                        {totalTopsPages > 1 && (
                            <div className="flex justify-center gap-1.5 pt-2">
                                {Array.from({ length: totalTopsPages }).map((_, i) => (
                                    <div key={i} className="rounded-full transition-all duration-300" style={{ width: i === topsPage ? 20 : 6, height: 6, background: i === topsPage ? 'white' : 'rgba(255,255,255,0.3)' }} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <SectionTitle label="Bottoms" />
                    <div {...bottomsSwipe} style={{ touchAction: 'pan-y', userSelect: 'none', cursor: 'grab' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                            {Array.from({ length: pageSize }).map((_, i) => {
                                const g = pagedBottoms[i];
                                return (
                                    <div key={i} className="rounded-md overflow-hidden flex items-center justify-center" style={{ aspectRatio: '1/1', borderRadius: '4px' }}>
                                        {g?.imageUrl && <img src={g.imageUrl} alt={g.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />}
                                    </div>
                                );
                            })}
                        </div>
                        {totalBottomsPages > 1 && (
                            <div className="flex justify-center gap-1.5 pt-2">
                                {Array.from({ length: totalBottomsPages }).map((_, i) => (
                                    <div key={i} className="rounded-full transition-all duration-300" style={{ width: i === bottomsPage ? 20 : 6, height: 6, background: i === bottomsPage ? 'white' : 'rgba(255,255,255,0.3)' }} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <SectionTitle label="Shoes" />
                    <div {...shoesSwipe} style={{ touchAction: 'pan-y', userSelect: 'none', cursor: 'grab' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                            {Array.from({ length: pageSize }).map((_, i) => {
                                const g = pagedShoes[i];
                                return (
                                    <div key={i} className="rounded-md overflow-hidden flex items-center justify-center" style={{ aspectRatio: '1/1', borderRadius: '4px'}}>
                                        {g?.imageUrl && <img src={g.imageUrl} alt={g.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />}
                                    </div>
                                );
                            })}
                        </div>
                        {totalShoesPages > 1 && (
                            <div className="flex justify-center gap-1.5 pt-2">
                                {Array.from({ length: totalShoesPages }).map((_, i) => (
                                    <div key={i} className="rounded-full transition-all duration-300" style={{ width: i === shoesPage ? 20 : 6, height: 6, background: i === shoesPage ? 'white' : 'rgba(255,255,255,0.3)' }} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
        <footer className="flex items-center justify-center" style={{ height: '150px'}}>
            <button style={{
                padding: '14px 32px',
                backgroundColor: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                letterSpacing: '0.5px',
            }}>
                Create Outfit
            </button>
        </footer>
    </div>
    );
}
