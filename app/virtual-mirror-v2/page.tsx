"use client";

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Shirt, Watch, Footprints, Sparkles, Trash2, Camera, Compass } from 'lucide-react';
import { useRouter } from 'next/navigation';
import "../../styles/glow.css";
import { garmentService, type RemoteGarment } from '@/modules/shared/api/garment.service';
import { FittingSlot } from '@/modules/garment/types';


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

    // Selection States
    const [selectedTop, setSelectedTop] = useState<RemoteGarment | null>(null);
    const [selectedBottom, setSelectedBottom] = useState<RemoteGarment | null>(null);
    const [selectedShoes, setSelectedShoes] = useState<RemoteGarment | null>(null);
    const [selectedHead, setSelectedHead] = useState<RemoteGarment | null>(null);
    const [selectedGlasses, setSelectedGlasses] = useState<RemoteGarment | null>(null);
    const [selectedEarrings, setSelectedEarrings] = useState<RemoteGarment | null>(null);
    const [selectedNeck, setSelectedNeck] = useState<RemoteGarment | null>(null);
    const [selectedWaist, setSelectedWaist] = useState<RemoteGarment | null>(null);
    const [selectedHand, setSelectedHand] = useState<RemoteGarment | null>(null);

    const [tops, setTops] = useState<RemoteGarment[]>([]);
    const [topsPage, setTopsPage] = useState(0);
    const totalTopsPages = Math.ceil(tops.length / pageSize);
    const pagedTops = tops.slice(topsPage * pageSize, (topsPage + 1) * pageSize);
    const topsSwipeStart = useRef<number | null>(null);
    const handleTopsTouchStart = (e: React.TouchEvent) => { topsSwipeStart.current = e.touches[0].clientX; };
    const handleTopsTouchEnd = (e: React.TouchEvent) => {
        if (topsSwipeStart.current === null) return;
        const delta = e.changedTouches[0].clientX - topsSwipeStart.current;
        topsSwipeStart.current = null;
        if (delta < -40) setTopsPage((p) => Math.min(p + 1, totalTopsPages - 1));
        else if (delta > 40) setTopsPage((p) => Math.max(p - 1, 0));
    };

    const [shoes, setShoes] = useState<RemoteGarment[]>([]);
    const [shoesPage, setShoesPage] = useState(0);
    const totalShoesPages = Math.ceil(shoes.length / pageSize);
    const pagedShoes = shoes.slice(shoesPage * pageSize, (shoesPage + 1) * pageSize);
    const shoesSwipeStart = useRef<number | null>(null);
    const handleShoesTouchStart = (e: React.TouchEvent) => { shoesSwipeStart.current = e.touches[0].clientX; };
    const handleShoesTouchEnd = (e: React.TouchEvent) => {
        if (shoesSwipeStart.current === null) return;
        const delta = e.changedTouches[0].clientX - shoesSwipeStart.current;
        shoesSwipeStart.current = null;
        if (delta < -40) setShoesPage((p) => Math.min(p + 1, totalShoesPages - 1));
        else if (delta > 40) setShoesPage((p) => Math.max(p - 1, 0));
    };

    const [bottoms, setBottoms] = useState<RemoteGarment[]>([]);
    const [bottomsPage, setBottomsPage] = useState(0);
    const totalBottomsPages = Math.ceil(bottoms.length / pageSize);
    const pagedBottoms = bottoms.slice(bottomsPage * pageSize, (bottomsPage + 1) * pageSize);
    const bottomsSwipeStart = useRef<number | null>(null);
    const handleBottomsTouchStart = (e: React.TouchEvent) => { bottomsSwipeStart.current = e.touches[0].clientX; };
    const handleBottomsTouchEnd = (e: React.TouchEvent) => {
        if (bottomsSwipeStart.current === null) return;
        const delta = e.changedTouches[0].clientX - bottomsSwipeStart.current;
        bottomsSwipeStart.current = null;
        if (delta < -40) setBottomsPage((p) => Math.min(p + 1, totalBottomsPages - 1));
        else if (delta > 40) setBottomsPage((p) => Math.max(p - 1, 0));
    };

    // Accessories — 6 categories (left + right hand combined)
    const [headGarments,    setHeadGarments]    = useState<RemoteGarment[]>([]);
    const [glasses,         setGlasses]         = useState<RemoteGarment[]>([]);
    const [earrings,        setEarrings]        = useState<RemoteGarment[]>([]);
    const [neckAccessories, setNeckAccessories] = useState<RemoteGarment[]>([]);
    const [waistAccessories,setWaistAccessories]= useState<RemoteGarment[]>([]);
    const [handAccessories, setHandAccessories] = useState<RemoteGarment[]>([]);

    const [headGarmentsPage, setHeadGarmentsPage] = useState(0);
    const totalHeadGarmentsPages = Math.ceil(headGarments.length / accessoryPageSize);
    const pagedHeadGarments = headGarments.slice(headGarmentsPage * accessoryPageSize, (headGarmentsPage + 1) * accessoryPageSize);
    const headGarmentsSwipeStart = useRef<number | null>(null);
    const handleHeadGarmentsTouchStart = (e: React.TouchEvent) => { headGarmentsSwipeStart.current = e.touches[0].clientX; };
    const handleHeadGarmentsTouchEnd = (e: React.TouchEvent) => {
        if (headGarmentsSwipeStart.current === null) return;
        const delta = e.changedTouches[0].clientX - headGarmentsSwipeStart.current;
        headGarmentsSwipeStart.current = null;
        if (delta < -40) setHeadGarmentsPage((p) => Math.min(p + 1, totalHeadGarmentsPages - 1));
        else if (delta > 40) setHeadGarmentsPage((p) => Math.max(p - 1, 0));
    };

    const [glassesPage, setGlassesPage] = useState(0);
    const totalGlassesPages = Math.ceil(glasses.length / accessoryPageSize);
    const pagedGlasses = glasses.slice(glassesPage * accessoryPageSize, (glassesPage + 1) * accessoryPageSize);
    const glassesSwipeStart = useRef<number | null>(null);
    const handleGlassesTouchStart = (e: React.TouchEvent) => { glassesSwipeStart.current = e.touches[0].clientX; };
    const handleGlassesTouchEnd = (e: React.TouchEvent) => {
        if (glassesSwipeStart.current === null) return;
        const delta = e.changedTouches[0].clientX - glassesSwipeStart.current;
        glassesSwipeStart.current = null;
        if (delta < -40) setGlassesPage((p) => Math.min(p + 1, totalGlassesPages - 1));
        else if (delta > 40) setGlassesPage((p) => Math.max(p - 1, 0));
    };

    const [earringsPage, setEarringsPage] = useState(0);
    const totalEarringsPages = Math.ceil(earrings.length / accessoryPageSize);
    const pagedEarrings = earrings.slice(earringsPage * accessoryPageSize, (earringsPage + 1) * accessoryPageSize);
    const earringsSwipeStart = useRef<number | null>(null);
    const handleEarringsTouchStart = (e: React.TouchEvent) => { earringsSwipeStart.current = e.touches[0].clientX; };
    const handleEarringsTouchEnd = (e: React.TouchEvent) => {
        if (earringsSwipeStart.current === null) return;
        const delta = e.changedTouches[0].clientX - earringsSwipeStart.current;
        earringsSwipeStart.current = null;
        if (delta < -40) setEarringsPage((p) => Math.min(p + 1, totalEarringsPages - 1));
        else if (delta > 40) setEarringsPage((p) => Math.max(p - 1, 0));
    };

    const [neckPage, setNeckPage] = useState(0);
    const totalNeckPages = Math.ceil(neckAccessories.length / accessoryPageSize);
    const pagedNeck = neckAccessories.slice(neckPage * accessoryPageSize, (neckPage + 1) * accessoryPageSize);
    const neckSwipeStart = useRef<number | null>(null);
    const handleNeckTouchStart = (e: React.TouchEvent) => { neckSwipeStart.current = e.touches[0].clientX; };
    const handleNeckTouchEnd = (e: React.TouchEvent) => {
        if (neckSwipeStart.current === null) return;
        const delta = e.changedTouches[0].clientX - neckSwipeStart.current;
        neckSwipeStart.current = null;
        if (delta < -40) setNeckPage((p) => Math.min(p + 1, totalNeckPages - 1));
        else if (delta > 40) setNeckPage((p) => Math.max(p - 1, 0));
    };

    const [waistPage, setWaistPage] = useState(0);
    const totalWaistPages = Math.ceil(waistAccessories.length / accessoryPageSize);
    const pagedWaist = waistAccessories.slice(waistPage * accessoryPageSize, (waistPage + 1) * accessoryPageSize);
    const waistSwipeStart = useRef<number | null>(null);
    const handleWaistTouchStart = (e: React.TouchEvent) => { waistSwipeStart.current = e.touches[0].clientX; };
    const handleWaistTouchEnd = (e: React.TouchEvent) => {
        if (waistSwipeStart.current === null) return;
        const delta = e.changedTouches[0].clientX - waistSwipeStart.current;
        waistSwipeStart.current = null;
        if (delta < -40) setWaistPage((p) => Math.min(p + 1, totalWaistPages - 1));
        else if (delta > 40) setWaistPage((p) => Math.max(p - 1, 0));
    };

    const [handPage, setHandPage] = useState(0);
    const totalHandPages = Math.ceil(handAccessories.length / accessoryPageSize);
    const pagedHand = handAccessories.slice(handPage * accessoryPageSize, (handPage + 1) * accessoryPageSize);
    const handSwipeStart = useRef<number | null>(null);
    const handleHandTouchStart = (e: React.TouchEvent) => { handSwipeStart.current = e.touches[0].clientX; };
    const handleHandTouchEnd = (e: React.TouchEvent) => {
        if (handSwipeStart.current === null) return;
        const delta = e.changedTouches[0].clientX - handSwipeStart.current;
        handSwipeStart.current = null;
        if (delta < -40) setHandPage((p) => Math.min(p + 1, totalHandPages - 1));
        else if (delta > 40) setHandPage((p) => Math.max(p - 1, 0));
    };

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

        // Accessories
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
        // Right Hand Accessory
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
            {/* Black container — Accessories / Shoes */}
            <div className="flex-1 h-full flex flex-col p-2 gap-2 min-h-0">
                <div className="flex flex-col gap-1">
                    <SectionTitle label="Accessories" />

                    <div onTouchStart={handleHeadGarmentsTouchStart} onTouchEnd={handleHeadGarmentsTouchEnd} style={{ touchAction: 'pan-y', userSelect: 'none' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                            {Array.from({ length: accessoryPageSize }).map((_, i) => {
                                const g = pagedHeadGarments[i];
                                const isSelected = selectedHead?.id === g?.id;
                                return (
                                    <button
                                        key={i}
                                        onClick={() => g && setSelectedHead(isSelected ? null : g)}
                                        className="rounded-md overflow-hidden flex items-center justify-center transition-all duration-200 active:scale-95 border outline-none"
                                        style={{
                                            aspectRatio: '1/1',
                                            borderRadius: '4px',
                                            borderColor: isSelected ? '#a855f7' : 'rgba(255, 255, 255, 0.1)',
                                            boxShadow: isSelected ? '0 0 10px rgba(168, 85, 247, 0.6)' : 'none',
                                            background: isSelected ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                            cursor: g ? 'pointer' : 'default',
                                        }}
                                    >
                                        {g?.imageUrl && <img src={g.imageUrl} alt={g.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />}
                                    </button>
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

                    <div onTouchStart={handleGlassesTouchStart} onTouchEnd={handleGlassesTouchEnd} style={{ touchAction: 'pan-y', userSelect: 'none' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                            {Array.from({ length: accessoryPageSize }).map((_, i) => {
                                const g = pagedGlasses[i];
                                const isSelected = selectedGlasses?.id === g?.id;
                                return (
                                    <button
                                        key={i}
                                        onClick={() => g && setSelectedGlasses(isSelected ? null : g)}
                                        className="rounded-md overflow-hidden flex items-center justify-center transition-all duration-200 active:scale-95 border outline-none"
                                        style={{
                                            aspectRatio: '1/1',
                                            borderRadius: '4px',
                                            borderColor: isSelected ? '#a855f7' : 'rgba(255, 255, 255, 0.1)',
                                            boxShadow: isSelected ? '0 0 10px rgba(168, 85, 247, 0.6)' : 'none',
                                            background: isSelected ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                            cursor: g ? 'pointer' : 'default',
                                        }}
                                    >
                                        {g?.imageUrl && <img src={g.imageUrl} alt={g.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />}
                                    </button>
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

                    <div onTouchStart={handleEarringsTouchStart} onTouchEnd={handleEarringsTouchEnd} style={{ touchAction: 'pan-y', userSelect: 'none' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                            {Array.from({ length: accessoryPageSize }).map((_, i) => {
                                const g = pagedEarrings[i];
                                const isSelected = selectedEarrings?.id === g?.id;
                                return (
                                    <button
                                        key={i}
                                        onClick={() => g && setSelectedEarrings(isSelected ? null : g)}
                                        className="rounded-md overflow-hidden flex items-center justify-center transition-all duration-200 active:scale-95 border outline-none"
                                        style={{
                                            aspectRatio: '1/1',
                                            borderRadius: '4px',
                                            borderColor: isSelected ? '#a855f7' : 'rgba(255, 255, 255, 0.1)',
                                            boxShadow: isSelected ? '0 0 10px rgba(168, 85, 247, 0.6)' : 'none',
                                            background: isSelected ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                            cursor: g ? 'pointer' : 'default',
                                        }}
                                    >
                                        {g?.imageUrl && <img src={g.imageUrl} alt={g.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />}
                                    </button>
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


                    <div onTouchStart={handleNeckTouchStart} onTouchEnd={handleNeckTouchEnd} style={{ touchAction: 'pan-y', userSelect: 'none' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                            {Array.from({ length: accessoryPageSize }).map((_, i) => {
                                const g = pagedNeck[i];
                                const isSelected = selectedNeck?.id === g?.id;
                                return (
                                    <button
                                        key={i}
                                        onClick={() => g && setSelectedNeck(isSelected ? null : g)}
                                        className="rounded-md overflow-hidden flex items-center justify-center transition-all duration-200 active:scale-95 border outline-none"
                                        style={{
                                            aspectRatio: '1/1',
                                            borderRadius: '4px',
                                            borderColor: isSelected ? '#a855f7' : 'rgba(255, 255, 255, 0.1)',
                                            boxShadow: isSelected ? '0 0 10px rgba(168, 85, 247, 0.6)' : 'none',
                                            background: isSelected ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                            cursor: g ? 'pointer' : 'default',
                                        }}
                                    >
                                        {g?.imageUrl && <img src={g.imageUrl} alt={g.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />}
                                    </button>
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


                    <div onTouchStart={handleWaistTouchStart} onTouchEnd={handleWaistTouchEnd} style={{ touchAction: 'pan-y', userSelect: 'none' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                            {Array.from({ length: accessoryPageSize }).map((_, i) => {
                                const g = pagedWaist[i];
                                const isSelected = selectedWaist?.id === g?.id;
                                return (
                                    <button
                                        key={i}
                                        onClick={() => g && setSelectedWaist(isSelected ? null : g)}
                                        className="rounded-md overflow-hidden flex items-center justify-center transition-all duration-200 active:scale-95 border outline-none"
                                        style={{
                                            aspectRatio: '1/1',
                                            borderRadius: '4px',
                                            borderColor: isSelected ? '#a855f7' : 'rgba(255, 255, 255, 0.1)',
                                            boxShadow: isSelected ? '0 0 10px rgba(168, 85, 247, 0.6)' : 'none',
                                            background: isSelected ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                            cursor: g ? 'pointer' : 'default',
                                        }}
                                    >
                                        {g?.imageUrl && <img src={g.imageUrl} alt={g.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />}
                                    </button>
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

                    {/* HandAccessory = Left + Right combined */}
                    <div onTouchStart={handleHandTouchStart} onTouchEnd={handleHandTouchEnd} style={{ touchAction: 'pan-y', userSelect: 'none' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                            {Array.from({ length: accessoryPageSize }).map((_, i) => {
                                const g = pagedHand[i];
                                const isSelected = selectedHand?.id === g?.id;
                                return (
                                    <button
                                        key={i}
                                        onClick={() => g && setSelectedHand(isSelected ? null : g)}
                                        className="rounded-md overflow-hidden flex items-center justify-center transition-all duration-200 active:scale-95 border outline-none"
                                        style={{
                                            aspectRatio: '1/1',
                                            borderRadius: '4px',
                                            borderColor: isSelected ? '#a855f7' : 'rgba(255, 255, 255, 0.1)',
                                            boxShadow: isSelected ? '0 0 10px rgba(168, 85, 247, 0.6)' : 'none',
                                            background: isSelected ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                            cursor: g ? 'pointer' : 'default',
                                        }}
                                    >
                                        {g?.imageUrl && <img src={g.imageUrl} alt={g.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />}
                                    </button>
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

            {/* Blue center panel */}
            <div className="flex-1 h-full flex flex-col items-center justify-start pt-8 gap-1">
                <span className="text-white font-thin select-none" style={{ fontSize: '3rem', lineHeight: 1 }}>{time}</span>
                <span className="text-white/80 text-xl font-light select-none mb-4">{day}, {date}</span>
                <div className="flex gap-2 mt-3">
                </div>
            </div>

            {/* Green container — Tops / Bottoms rows, 3×3 each */}
            <div className="flex-1 h-full flex flex-col p-2 gap-2 min-h-0">
                {/* Tops — real garment images with pagination */}
                <div className="flex flex-col gap-1">
                    <SectionTitle label="Tops" />
                    {/* Swipe container — touchAction pan-y lets browser scroll vertically but passes horizontal swipes to JS */}
                    <div
                        onTouchStart={handleTopsTouchStart}
                        onTouchEnd={handleTopsTouchEnd}
                        style={{ touchAction: 'pan-y', userSelect: 'none' }}
                    >
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                            {Array.from({ length: pageSize }).map((_, i) => {
                                const g = pagedTops[i];
                                const isSelected = selectedTop?.id === g?.id;
                                return (
                                    <button
                                        key={i}
                                        onClick={() => g && setSelectedTop(isSelected ? null : g)}
                                        className="rounded-md overflow-hidden flex items-center justify-center transition-all duration-200 active:scale-95 border outline-none"
                                        style={{
                                            aspectRatio: '1/1',
                                            borderRadius: '4px',
                                            borderColor: isSelected ? '#a855f7' : 'rgba(255, 255, 255, 0.1)',
                                            boxShadow: isSelected ? '0 0 10px rgba(168, 85, 247, 0.6)' : 'none',
                                            background: isSelected ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                            cursor: g ? 'pointer' : 'default',
                                        }}
                                    >
                                        {g?.imageUrl && <img src={g.imageUrl} alt={g.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />}
                                    </button>
                                );
                            })}
                        </div>
                        {/* Pagination dots — swipe-only indicators */}
                        {totalTopsPages > 1 && (
                            <div className="flex justify-center gap-1.5 pt-2">
                                {Array.from({ length: totalTopsPages }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="rounded-full transition-all duration-300"
                                        style={{ width: i === topsPage ? 20 : 6, height: 6, background: i === topsPage ? 'white' : 'rgba(255,255,255,0.3)' }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottoms */}
                <div className="flex flex-col gap-1">
                    <SectionTitle label="Bottoms" />
                    <div
                        onTouchStart={handleBottomsTouchStart}
                        onTouchEnd={handleBottomsTouchEnd}
                        style={{ touchAction: 'pan-y', userSelect: 'none' }}
                    >
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                            {Array.from({ length: pageSize }).map((_, i) => {
                                const g = pagedBottoms[i];
                                const isSelected = selectedBottom?.id === g?.id;
                                return (
                                    <button
                                        key={i}
                                        onClick={() => g && setSelectedBottom(isSelected ? null : g)}
                                        className="rounded-md overflow-hidden flex items-center justify-center transition-all duration-200 active:scale-95 border outline-none"
                                        style={{
                                            aspectRatio: '1/1',
                                            borderRadius: '4px',
                                            borderColor: isSelected ? '#a855f7' : 'rgba(255, 255, 255, 0.1)',
                                            boxShadow: isSelected ? '0 0 10px rgba(168, 85, 247, 0.6)' : 'none',
                                            background: isSelected ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                            cursor: g ? 'pointer' : 'default',
                                        }}
                                    >
                                        {g?.imageUrl && <img src={g.imageUrl} alt={g.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />}
                                    </button>
                                );
                            })}
                        </div>
                        {totalBottomsPages > 1 && (
                            <div className="flex justify-center gap-1.5 pt-2">
                                {Array.from({ length: totalBottomsPages }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="rounded-full transition-all duration-300"
                                        style={{ width: i === bottomsPage ? 20 : 6, height: 6, background: i === bottomsPage ? 'white' : 'rgba(255,255,255,0.3)' }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Shoes */}
                <div className="flex flex-col gap-1">
                    <SectionTitle label="Shoes" />
                    <div
                        onTouchStart={handleShoesTouchStart}
                        onTouchEnd={handleShoesTouchEnd}
                        style={{ touchAction: 'pan-y', userSelect: 'none' }}
                    >
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                            {Array.from({ length: pageSize }).map((_, i) => {
                                const g = pagedShoes[i];
                                const isSelected = selectedShoes?.id === g?.id;
                                return (
                                    <button
                                        key={i}
                                        onClick={() => g && setSelectedShoes(isSelected ? null : g)}
                                        className="rounded-md overflow-hidden flex items-center justify-center transition-all duration-200 active:scale-95 border outline-none"
                                        style={{
                                            aspectRatio: '1/1',
                                            borderRadius: '4px',
                                            borderColor: isSelected ? '#a855f7' : 'rgba(255, 255, 255, 0.1)',
                                            boxShadow: isSelected ? '0 0 10px rgba(168, 85, 247, 0.6)' : 'none',
                                            background: isSelected ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                            cursor: g ? 'pointer' : 'default',
                                        }}
                                    >
                                        {g?.imageUrl && <img src={g.imageUrl} alt={g.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />}
                                    </button>
                                );
                            })}
                        </div>
                        {totalShoesPages > 1 && (
                            <div className="flex justify-center gap-1.5 pt-2">
                                {Array.from({ length: totalShoesPages }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="rounded-full transition-all duration-300"
                                        style={{ width: i === shoesPage ? 20 : 6, height: 6, background: i === shoesPage ? 'white' : 'rgba(255,255,255,0.3)' }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
        {/* Glassmorphic Action Dock Footer */}
        <footer 
            className="flex items-center justify-between px-8 shrink-0 relative z-30" 
            style={{ 
                height: '150px', 
                background: 'rgba(255, 255, 255, 0.04)', 
                backdropFilter: 'blur(16px)', 
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.5)'
            }}
        >
            {/* Left: Selected Outfit Preview */}
            <div className="flex flex-col gap-2 flex-1">
                <span className="text-white/40 text-[10px] font-bold tracking-widest uppercase">Current Selections</span>
                
                {!(selectedTop || selectedBottom || selectedShoes || selectedHead || selectedGlasses || selectedEarrings || selectedNeck || selectedWaist || selectedHand) ? (
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-white/30 animate-pulse" />
                        <span className="text-white/30 text-sm italic select-none">Select items from the grids above to build your look...</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-3 overflow-x-auto py-1 max-w-[70vw] scrollbar-hide">
                        {selectedHead && (
                            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 shrink-0">
                                <span className="text-xs">🎩</span>
                                <span className="text-white text-xs font-medium max-w-[80px] truncate">{selectedHead.name.replace(/^"|"$/g, "")}</span>
                            </div>
                        )}
                        {selectedGlasses && (
                            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 shrink-0">
                                <span className="text-xs">🕶️</span>
                                <span className="text-white text-xs font-medium max-w-[80px] truncate">{selectedGlasses.name.replace(/^"|"$/g, "")}</span>
                            </div>
                        )}
                        {selectedEarrings && (
                            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 shrink-0">
                                <span className="text-xs">💎</span>
                                <span className="text-white text-xs font-medium max-w-[80px] truncate">{selectedEarrings.name.replace(/^"|"$/g, "")}</span>
                            </div>
                        )}
                        {selectedNeck && (
                            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 shrink-0">
                                <span className="text-xs">📿</span>
                                <span className="text-white text-xs font-medium max-w-[80px] truncate">{selectedNeck.name.replace(/^"|"$/g, "")}</span>
                            </div>
                        )}
                        {selectedTop && (
                            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 shrink-0">
                                <Shirt className="w-3.5 h-3.5 text-white/70" strokeWidth={2} />
                                <span className="text-white text-xs font-medium max-w-[80px] truncate">{selectedTop.name.replace(/^"|"$/g, "")}</span>
                            </div>
                        )}
                        {selectedWaist && (
                            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 shrink-0">
                                <span className="text-xs">🎗️</span>
                                <span className="text-white text-xs font-medium max-w-[80px] truncate">{selectedWaist.name.replace(/^"|"$/g, "")}</span>
                            </div>
                        )}
                        {selectedHand && (
                            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 shrink-0">
                                <Watch className="w-3.5 h-3.5 text-white/70" strokeWidth={2} />
                                <span className="text-white text-xs font-medium max-w-[80px] truncate">{selectedHand.name.replace(/^"|"$/g, "")}</span>
                            </div>
                        )}
                        {selectedBottom && (
                            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 shrink-0">
                                <span className="text-xs">👖</span>
                                <span className="text-white text-xs font-medium max-w-[80px] truncate">{selectedBottom.name.replace(/^"|"$/g, "")}</span>
                            </div>
                        )}
                        {selectedShoes && (
                            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 shrink-0">
                                <Footprints className="w-3.5 h-3.5 text-white/70" strokeWidth={2} />
                                <span className="text-white text-xs font-medium max-w-[80px] truncate">{selectedShoes.name.replace(/^"|"$/g, "")}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3 shrink-0">
                {(selectedTop || selectedBottom || selectedShoes || selectedHead || selectedGlasses || selectedEarrings || selectedNeck || selectedWaist || selectedHand) && (
                    <button
                        onClick={() => {
                            setSelectedTop(null);
                            setSelectedBottom(null);
                            setSelectedShoes(null);
                            setSelectedHead(null);
                            setSelectedGlasses(null);
                            setSelectedEarrings(null);
                            setSelectedNeck(null);
                            setSelectedWaist(null);
                            setSelectedHand(null);
                        }}
                        className="px-6 py-4 rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-white/20 active:scale-95 transition-all flex items-center gap-2 font-medium"
                    >
                        <Trash2 className="w-4 h-4 text-white/60" />
                        <span>Clear All</span>
                    </button>
                )}
                
                <button
                    disabled={!(selectedTop || selectedBottom || selectedShoes || selectedHead || selectedGlasses || selectedEarrings || selectedNeck || selectedWaist || selectedHand)}
                    onClick={() => {
                        const mapGarment = (g: RemoteGarment | null, slot: FittingSlot) => {
                            if (!g) return null;
                            const cleanName = g.name.replace(/^"|"$/g, "");
                            const url = g.file?.fileUrl ?? g.imageUrl ?? "";
                            const gType = (g.garmentType?.[0] ?? "").toLowerCase();
                            return {
                                id: g.id,
                                name: cleanName,
                                imageUrl: url,
                                slot,
                                garmentType: gType,
                            };
                        };

                        const slotMap = {
                            [FittingSlot.HeadGarment]:        { slot: FittingSlot.HeadGarment,        label: "Head",         garment: mapGarment(selectedHead, FittingSlot.HeadGarment) },
                            [FittingSlot.Glasses]:            { slot: FittingSlot.Glasses,            label: "Glasses",      garment: mapGarment(selectedGlasses, FittingSlot.Glasses) },
                            [FittingSlot.Earrings]:           { slot: FittingSlot.Earrings,           label: "Earrings",     garment: mapGarment(selectedEarrings, FittingSlot.Earrings) },
                            [FittingSlot.UpperGarment]:       { slot: FittingSlot.UpperGarment,       label: "Upper",        garment: mapGarment(selectedTop, FittingSlot.UpperGarment) },
                            [FittingSlot.LowerGarment]:       { slot: FittingSlot.LowerGarment,       label: "Lower",        garment: mapGarment(selectedBottom, FittingSlot.LowerGarment) },
                            [FittingSlot.FullGarment]:        { slot: FittingSlot.FullGarment,        label: "Full",         garment: null },
                            [FittingSlot.FootGarment]:        { slot: FittingSlot.FootGarment,        label: "Footwear",     garment: mapGarment(selectedShoes, FittingSlot.FootGarment) },
                            [FittingSlot.LeftHandAccessory]:  { slot: FittingSlot.LeftHandAccessory,  label: "L. Hand",      garment: mapGarment(selectedHand, FittingSlot.LeftHandAccessory) },
                            [FittingSlot.RightHandAccessory]: { slot: FittingSlot.RightHandAccessory, label: "R. Hand",      garment: null },
                            [FittingSlot.NeckAccessory]:      { slot: FittingSlot.NeckAccessory,      label: "Neck",         garment: mapGarment(selectedNeck, FittingSlot.NeckAccessory) },
                            [FittingSlot.WaistAccessory]:     { slot: FittingSlot.WaistAccessory,     label: "Waist",        garment: mapGarment(selectedWaist, FittingSlot.WaistAccessory) },
                        };

                        localStorage.setItem("mirror_outfit_slots", JSON.stringify(slotMap));
                        router.push("/try-it-on");
                    }}
                    className={`px-8 py-4 rounded-xl font-bold transition-all duration-300 flex items-center gap-2 select-none ${
                        (selectedTop || selectedBottom || selectedShoes || selectedHead || selectedGlasses || selectedEarrings || selectedNeck || selectedWaist || selectedHand)
                            ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-[0_4px_20px_rgba(168,85,247,0.4)] hover:brightness-110 hover:shadow-[0_4px_25px_rgba(168,85,247,0.6)] cursor-pointer active:scale-95"
                            : "bg-white/5 border border-white/5 text-white/20 cursor-not-allowed"
                    }`}
                >
                    <Sparkles className="w-5 h-5" />
                    <span>Try On Outfit</span>
                </button>
            </div>
        </footer>
    </div>
    );
}