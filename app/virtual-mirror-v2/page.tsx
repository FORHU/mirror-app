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
    const accessoryPageSize = 3;

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
    const [bracelets,        setBracelets]        = useState<RemoteGarment[]>([]);
    const [watches,          setWatches]          = useState<RemoteGarment[]>([]);
    const [bags,             setBags]             = useState<RemoteGarment[]>([]);

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

    const [braceletsPage, setBraceletsPage] = useState(0);
    const totalBraceletsPages = Math.ceil(bracelets.length / accessoryPageSize);
    const pagedBracelets = bracelets.slice(braceletsPage * accessoryPageSize, (braceletsPage + 1) * accessoryPageSize);
    const braceletSwipe = useSwipe(
        () => setBraceletsPage((p) => Math.min(p + 1, totalBraceletsPages - 1)),
        () => setBraceletsPage((p) => Math.max(p - 1, 0)),
    );

    const [watchesPage, setWatchesPage] = useState(0);
    const totalWatchesPages = Math.ceil(watches.length / accessoryPageSize);
    const pagedWatches = watches.slice(watchesPage * accessoryPageSize, (watchesPage + 1) * accessoryPageSize);
    const watchSwipe = useSwipe(
        () => setWatchesPage((p) => Math.min(p + 1, totalWatchesPages - 1)),
        () => setWatchesPage((p) => Math.max(p - 1, 0)),
    );

    const [bagsPage, setBagsPage] = useState(0);
    const totalBagsPages = Math.ceil(bags.length / accessoryPageSize);
    const pagedBags = bags.slice(bagsPage * accessoryPageSize, (bagsPage + 1) * accessoryPageSize);
    const bagSwipe = useSwipe(
        () => setBagsPage((p) => Math.min(p + 1, totalBagsPages - 1)),
        () => setBagsPage((p) => Math.max(p - 1, 0)),
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
        garmentService.getBySlotAndType(FittingSlot.RightHandAccessory, 'Bracelet')
            .then(setBracelets)
            .catch((err) => console.error('[Bracelet] fetch error:', err));
        garmentService.getBySlotAndType(FittingSlot.RightHandAccessory, 'Watch')
            .then(setWatches)
            .catch((err) => console.error('[Watch] fetch error:', err));
        garmentService.getBySlotAndType(FittingSlot.RightHandAccessory, 'Bag')
            .then(setBags)
            .catch((err) => console.error('[Bag] fetch error:', err));
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

                    <div {...headSwipe} style={{ touchAction: 'pan-y', userSelect: 'none', cursor: 'grab', marginBottom: '5px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }} className='glass-card'>
                            {Array.from({ length: accessoryPageSize }).map((_, i) => {
                                const g = pagedHeadGarments[i];
                                return (
                                    <div key={i} className="rounded-md overflow-hidden flex items-center justify-center" style={{ aspectRatio: '1/1', borderRadius: '4px', marginTop: '5px', marginBottom: '5px' }}>
                                        {g?.imageUrl && <img src={g.imageUrl} alt={g.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-center gap-1.5 pt-2">
                            {Array.from({ length: Math.max(1, totalHeadGarmentsPages) }).map((_, i) => (
                                <button key={i} type="button" onClick={() => setHeadGarmentsPage(i)} aria-label={`Go to page ${i + 1}`} className="rounded-full transition-all duration-300" style={{ width: i === headGarmentsPage ? 12 : 4, height: 4, background: i === headGarmentsPage ? 'white' : 'rgba(255,255,255,0.3)', border: 'none', padding: 0, cursor: 'pointer' }} />
                            ))}
                        </div>
                    </div>

                    <div {...glassesSwipe} style={{ touchAction: 'pan-y', userSelect: 'none', cursor: 'grab', marginBottom: '5px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }} className='glass-card'>
                            {Array.from({ length: accessoryPageSize }).map((_, i) => {
                                const g = pagedGlasses[i];
                                return (
                                    <div key={i} className="rounded-md overflow-hidden flex items-center justify-center" style={{ aspectRatio: '1/1', borderRadius: '4px', marginTop: '5px', marginBottom: '5px' }}>
                                        {g?.imageUrl && <img src={g.imageUrl} alt={g.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-center gap-1.5 pt-2">
                            {Array.from({ length: Math.max(1, totalGlassesPages) }).map((_, i) => (
                                <button key={i} type="button" onClick={() => setGlassesPage(i)} aria-label={`Go to page ${i + 1}`} className="rounded-full transition-all duration-300" style={{ width: i === glassesPage ? 12 : 4, height: 4, background: i === glassesPage ? 'white' : 'rgba(255,255,255,0.3)', border: 'none', padding: 0, cursor: 'pointer' }} />
                            ))}
                        </div>
                    </div>

                    <div {...earringsSwipe} style={{ touchAction: 'pan-y', userSelect: 'none', cursor: 'grab', marginBottom: '5px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }} className='glass-card'>
                            {Array.from({ length: accessoryPageSize }).map((_, i) => {
                                const g = pagedEarrings[i];
                                return (
                                    <div key={i} className="rounded-md overflow-hidden flex items-center justify-center" style={{ aspectRatio: '1/1', borderRadius: '4px', marginTop: '5px', marginBottom: '5px' }}>
                                        {g?.imageUrl && <img src={g.imageUrl} alt={g.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-center gap-1.5 pt-2">
                            {Array.from({ length: Math.max(1, totalEarringsPages) }).map((_, i) => (
                                <button key={i} type="button" onClick={() => setEarringsPage(i)} aria-label={`Go to page ${i + 1}`} className="rounded-full transition-all duration-300" style={{ width: i === earringsPage ? 12 : 4, height: 4, background: i === earringsPage ? 'white' : 'rgba(255,255,255,0.3)', border: 'none', padding: 0, cursor: 'pointer' }} />
                            ))}
                        </div>
                    </div>

                    <div {...neckSwipe} style={{ touchAction: 'pan-y', userSelect: 'none', cursor: 'grab', marginBottom: '5px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }} className='glass-card'>
                            {Array.from({ length: accessoryPageSize }).map((_, i) => {
                                const g = pagedNeck[i];
                                return (
                                    <div key={i} className="rounded-md overflow-hidden flex items-center justify-center" style={{ aspectRatio: '1/1', borderRadius: '4px', marginTop: '5px', marginBottom: '5px' }}>
                                        {g?.imageUrl && <img src={g.imageUrl} alt={g.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-center gap-1.5 pt-2">
                            {Array.from({ length: Math.max(1, totalNeckPages) }).map((_, i) => (
                                <button key={i} type="button" onClick={() => setNeckPage(i)} aria-label={`Go to page ${i + 1}`} className="rounded-full transition-all duration-300" style={{ width: i === neckPage ? 12 : 4, height: 4, background: i === neckPage ? 'white' : 'rgba(255,255,255,0.3)', border: 'none', padding: 0, cursor: 'pointer' }} />
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <SectionTitle label="Outfit" />
                    <div {...headSwipe} style={{ touchAction: 'pan-y', userSelect: 'none', cursor: 'grab' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                            {Array.from({ length: accessoryPageSize }).map((_, i) => {
                                const g = pagedHeadGarments[i];
                                return (
                                    <div key={i} className="rounded-md overflow-hidden flex items-center justify-center" style={{ aspectRatio: '1/1', borderRadius: '4px'}}>
                                        {g?.imageUrl && <img src={g.imageUrl} alt={g.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-center gap-1.5 pt-2">
                            {Array.from({ length: Math.max(1, totalHeadGarmentsPages) }).map((_, i) => (
                                <button key={i} type="button" onClick={() => setHeadGarmentsPage(i)} aria-label={`Go to page ${i + 1}`} className="rounded-full transition-all duration-300" style={{ width: i === headGarmentsPage ? 20 : 6, height: 6, background: i === headGarmentsPage ? 'white' : 'rgba(255,255,255,0.3)', border: 'none', padding: 0, cursor: 'pointer' }} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Center panel */}
            <div className="flex-[2] h-full flex flex-col items-center justify-start pt-8 gap-1" style={{background: 'red'}}>
                <span className="text-white font-thin select-none" style={{ fontSize: '3rem', lineHeight: 1 }}>{time}</span>
                <span className="text-white/80 text-xl font-light select-none mb-4">{day}, {date}</span>
                <div className="flex gap-2 mt-3">
                </div>
            </div>

            {/* Right panel — Tops / Bottoms / Shoes */}
            <div className="flex-1 h-full flex flex-col p-2 gap-2 min-h-0">
                <div className="flex flex-col gap-1">
                    
                    <SectionTitle label="Accessories" />
                     {/* bracelet */}
                    <div {...braceletSwipe} style={{ touchAction: 'pan-y', userSelect: 'none', cursor: 'grab', marginBottom: '5px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }} className='glass-card'>
                            {Array.from({ length: accessoryPageSize }).map((_, i) => {
                                const g = pagedBracelets[i];
                                return (
                                    <div key={i} className="rounded-md overflow-hidden flex items-center justify-center" style={{ aspectRatio: '1/1', borderRadius: '4px', marginTop: '5px', marginBottom: '5px'}}>
                                        {g?.imageUrl && <img src={g.imageUrl} alt={g.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-center gap-1.5 pt-2">
                            {Array.from({ length: Math.max(1, totalBraceletsPages) }).map((_, i) => (
                                <button key={i} type="button" onClick={() => setBraceletsPage(i)} aria-label={`Go to page ${i + 1}`} className="rounded-full transition-all duration-300" style={{ width: i === braceletsPage ? 12 : 4, height: 4, background: i === braceletsPage ? 'white' : 'rgba(255,255,255,0.3)', border: 'none', padding: 0, cursor: 'pointer' }} />
                            ))}
                        </div>
                    </div>

                    {/* watch */}
                    <div {...watchSwipe} style={{ touchAction: 'pan-y', userSelect: 'none', cursor: 'grab', marginBottom: '5px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }} className='glass-card'>
                            {Array.from({ length: accessoryPageSize }).map((_, i) => {
                                const g = pagedWatches[i];
                                return (
                                    <div key={i} className="rounded-md overflow-hidden flex items-center justify-center" style={{ aspectRatio: '1/1', borderRadius: '4px', marginTop: '5px', marginBottom: '5px'}}>
                                        {g?.imageUrl && <img src={g.imageUrl} alt={g.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-center gap-1.5 pt-2">
                            {Array.from({ length: Math.max(1, totalWatchesPages) }).map((_, i) => (
                                <button key={i} type="button" onClick={() => setWatchesPage(i)} aria-label={`Go to page ${i + 1}`} className="rounded-full transition-all duration-300" style={{ width: i === watchesPage ? 12 : 4, height: 4, background: i === watchesPage ? 'white' : 'rgba(255,255,255,0.3)', border: 'none', padding: 0, cursor: 'pointer' }} />
                            ))}
                        </div>
                    </div>

                    {/* bag */}
                    <div {...bagSwipe} style={{ touchAction: 'pan-y', userSelect: 'none', cursor: 'grab', marginBottom: '5px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }} className='glass-card'>
                            {Array.from({ length: accessoryPageSize }).map((_, i) => {
                                const g = pagedBags[i];
                                return (
                                    <div key={i} className="rounded-md overflow-hidden flex items-center justify-center" style={{ aspectRatio: '1/1', borderRadius: '4px', marginTop: '5px', marginBottom: '5px'}}>
                                        {g?.imageUrl && <img src={g.imageUrl} alt={g.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-center gap-1.5 pt-2">
                            {Array.from({ length: Math.max(1, totalBagsPages) }).map((_, i) => (
                                <button key={i} type="button" onClick={() => setBagsPage(i)} aria-label={`Go to page ${i + 1}`} className="rounded-full transition-all duration-300" style={{ width: i === bagsPage ? 12 : 4, height: 4, background: i === bagsPage ? 'white' : 'rgba(255,255,255,0.3)', border: 'none', padding: 0, cursor: 'pointer' }} />
                            ))}
                        </div>
                    </div>

                    <SectionTitle label="Tops" />
                    <div {...topsSwipe} style={{ touchAction: 'pan-y', userSelect: 'none', cursor: 'grab' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }} className='glass-card'>
                            {Array.from({ length: pageSize }).map((_, i) => {
                                const g = pagedTops[i];
                                return (
                                    <div key={i} className="rounded-md overflow-hidden flex items-center justify-center" style={{ aspectRatio: '1/1', borderRadius: '4px'}}>
                                        {g?.imageUrl && <img src={g.imageUrl} alt={g.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-center gap-1.5 pt-2">
                            {Array.from({ length: Math.max(1, totalTopsPages) }).map((_, i) => (
                                <div key={i} className="rounded-full transition-all duration-300" style={{ width: i === topsPage ? 12 : 4, height: 4, background: i === topsPage ? 'white' : 'rgba(255,255,255,0.3)' }} />
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <SectionTitle label="Bottoms" />
                    <div {...bottomsSwipe} style={{ touchAction: 'pan-y', userSelect: 'none', cursor: 'grab' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }} className='glass-card'>
                            {Array.from({ length: pageSize }).map((_, i) => {
                                const g = pagedBottoms[i];
                                return (
                                    <div key={i} className="rounded-md overflow-hidden flex items-center justify-center" style={{ aspectRatio: '1/1', borderRadius: '4px' }}>
                                        {g?.imageUrl && <img src={g.imageUrl} alt={g.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-center gap-1.5 pt-2">
                            {Array.from({ length: Math.max(1, totalBottomsPages) }).map((_, i) => (
                                <div key={i} className="rounded-full transition-all duration-300" style={{ width: i === bottomsPage ? 12 : 4, height: 4, background: i === bottomsPage ? 'white' : 'rgba(255,255,255,0.3)' }} />
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <SectionTitle label="Shoes" />
                    <div {...shoesSwipe} style={{ touchAction: 'pan-y', userSelect: 'none', cursor: 'grab' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }} className='glass-card'>
                            {Array.from({ length: pageSize }).map((_, i) => {
                                const g = pagedShoes[i];
                                return (
                                    <div key={i} className="rounded-md overflow-hidden flex items-center justify-center" style={{ aspectRatio: '1/1', borderRadius: '4px'}}>
                                        {g?.imageUrl && <img src={g.imageUrl} alt={g.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-center gap-1.5 pt-2">
                            {Array.from({ length: Math.max(1, totalShoesPages) }).map((_, i) => (
                                <div key={i} className="rounded-full transition-all duration-300" style={{ width: i === shoesPage ? 12 : 4, height: 4, background: i === shoesPage ? 'white' : 'rgba(255,255,255,0.3)' }} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <footer className="flex items-center justify-center" style={{ height: '70px', background: 'blue'}}>
            <button style={{
                padding: '14px 32px',
                backgroundColor: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                letterSpacing: '0.5px'
            }}>
                Create Outfit
            </button>
        </footer>
    </div>
    );
}
