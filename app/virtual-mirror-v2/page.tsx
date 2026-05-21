"use client";

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import "../../styles/glow.css";
import { garmentService, type RemoteGarment } from '@/modules/shared/api/garment.service';
import { outfitService, type RemoteOutfit } from '@/modules/shared/api/outfit.service';
import { FittingSlot } from '@/modules/garment/types';
import WeatherWidget from '@/components/WeatherWidget';
import OutfitPreviewCanvas from '@/components/OutfitPreviewCanvas';

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

function SkeletonCell({ ratio = '1/1', style }: { ratio?: string; style?: React.CSSProperties }) {
    return (
        <div className="animate-pulse" style={{ aspectRatio: ratio, background: 'rgba(255,255,255,0.1)', borderRadius: '4px', ...style }} />
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
    const now = useClock();

    const [outfits, setOutfits] = useState<RemoteOutfit[]>([]);
    const [selectedOutfitIdx, setSelectedOutfitIdx] = useState<number | null>(null);
    const [selectedHat,    setSelectedHat]    = useState<RemoteGarment | null>(null);
    const [selectedBag,    setSelectedBag]    = useState<RemoteGarment | null>(null);
    const [selectedTop,    setSelectedTop]    = useState<RemoteGarment | null>(null);
    const [selectedBottom, setSelectedBottom] = useState<RemoteGarment | null>(null);
    const [selectedShoe,   setSelectedShoe]   = useState<RemoteGarment | null>(null);
    const [loadingGarments, setLoadingGarments] = useState(true);
    const [loadingOutfits,  setLoadingOutfits]  = useState(true);
    const [showConfirm, setShowConfirm] = useState(false);

    const clearSlots = () => { setSelectedHat(null); setSelectedBag(null); setSelectedTop(null); setSelectedBottom(null); setSelectedShoe(null); };
    const selectOutfit = (idx: number) => { setSelectedOutfitIdx(idx); clearSlots(); };
    const outfitPageSize = 10;
    const [outfitPage, setOutfitPage] = useState(0);
    const totalOutfitPages = Math.max(1, Math.ceil(outfits.length / outfitPageSize));
    const pagedOutfits = outfits.slice(outfitPage * outfitPageSize, (outfitPage + 1) * outfitPageSize);
    const outfitSwipe = useSwipe(
        () => setOutfitPage((p) => Math.min(p + 1, totalOutfitPages - 1)),
        () => setOutfitPage((p) => Math.max(p - 1, 0)),
    );

    const pageSize = 8;
    const shoesPageSize = 6;
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
    const totalShoesPages = Math.ceil(shoes.length / shoesPageSize);
    const pagedShoes = shoes.slice(shoesPage * shoesPageSize, (shoesPage + 1) * shoesPageSize);
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
        // Garment grids resolve independently from the outfit grid
        Promise.allSettled([
            garmentService.getBySlot(FittingSlot.UpperGarment).then(setTops).catch((err) => console.error('[Tops] fetch error:', err)),
            garmentService.getBySlot(FittingSlot.LowerGarment).then(setBottoms).catch((err) => console.error('[Bottoms] fetch error:', err)),
            garmentService.getBySlot(FittingSlot.FootGarment).then(setShoes).catch((err) => console.error('[Shoes] fetch error:', err)),
            garmentService.getBySlot(FittingSlot.HeadGarment).then(setHeadGarments).catch((err) => console.error('[HeadGarment] fetch error:', err)),
            garmentService.getBySlot(FittingSlot.Glasses).then(setGlasses).catch((err) => console.error('[Glasses] fetch error:', err)),
            garmentService.getBySlot(FittingSlot.Earrings).then(setEarrings).catch((err) => console.error('[Earrings] fetch error:', err)),
            garmentService.getBySlot(FittingSlot.NeckAccessory).then(setNeckAccessories).catch((err) => console.error('[NeckAccessory] fetch error:', err)),
            garmentService.getBySlot(FittingSlot.WaistAccessory).then(setWaistAccessories).catch((err) => console.error('[WaistAccessory] fetch error:', err)),
            garmentService.getBySlotAndType(FittingSlot.RightHandAccessory, 'Bracelet').then(setBracelets).catch((err) => console.error('[Bracelet] fetch error:', err)),
            garmentService.getBySlotAndType(FittingSlot.RightHandAccessory, 'Watch').then(setWatches).catch((err) => console.error('[Watch] fetch error:', err)),
            garmentService.getBySlotAndType(FittingSlot.RightHandAccessory, 'Bag').then(setBags).catch((err) => console.error('[Bag] fetch error:', err)),
        ]).finally(() => setLoadingGarments(false));

        outfitService.getAll()
            .then(setOutfits)
            .catch((err) => console.error('[Outfits] fetch error:', err))
            .finally(() => setLoadingOutfits(false));
    }, []);

    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const day  = now.toLocaleDateString([], { weekday: 'long' });
    const date = now.toLocaleDateString([], { month: 'long', day: 'numeric' });

    return (
    <div className="relative w-screen h-screen overflow-hidden bg-black flex flex-col">
        <header
            className={'flex items-center shrink-0 py-4 px-4'}
            style={{ background: 'rgba(0,0,0,0.85)' }}
        >
            <div style={{ flex: '0 0 25%', width: '25%', display: 'flex', alignItems: 'center' }}>
                <WeatherWidget iconSize={32} />
            </div>
            <div style={{ flex: '0 0 50%', width: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span className="text-white font-thin select-none shrink-0" style={{ fontSize: '3rem', lineHeight: 1 }}>{time}</span>
                <span className="text-white/80 text-xl font-light select-none shrink-0">{day}, {date}</span>
            </div>
            <div style={{ flex: '0 0 25%', width: '25%', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => router.push('/logged-in')} className="p-4 transition-all hover:scale-105 active:scale-95">
                    <ArrowLeft className="w-6 h-6 text-white" />
                </button>
            </div>
        </header>
        <div className="flex flex-1" style={{ height: '546px'}}>
            {/* Left panel — Accessories */}
            <div className="h-full flex flex-col p-2 gap-2 min-h-0 overflow-hidden" style={{ flex: '0 0 25%', width: '25%' }}>
                <div className="flex flex-col gap-1">
                    <SectionTitle label="Accessories" />

                    <div {...headSwipe} style={{ touchAction: 'pan-y', userSelect: 'none', cursor: 'grab', marginBottom: '5px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }} className='glass-card'>
                            {Array.from({ length: accessoryPageSize }).map((_, i) => {
                                if (loadingGarments) return <SkeletonCell key={i} style={{ marginTop: '5px', marginBottom: '5px' }} />;
                                const g = pagedHeadGarments[i];
                                return (
                                    <div key={i} onClick={() => g && (setSelectedHat(g), setSelectedOutfitIdx(null))} className="rounded-md overflow-hidden flex items-center justify-center" style={{ aspectRatio: '1/1', borderRadius: '4px', marginTop: '5px', marginBottom: '5px', cursor: g ? 'pointer' : 'default', border: (g && selectedHat?.id === g.id) ? '1.5px solid rgba(255,255,255,0.6)' : '1.5px solid transparent' }}>
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

                    {/* <div {...glassesSwipe} style={{ touchAction: 'pan-y', userSelect: 'none', cursor: 'grab', marginBottom: '5px' }}>
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
                    </div> */}

                    {/* <div {...earringsSwipe} style={{ touchAction: 'pan-y', userSelect: 'none', cursor: 'grab', marginBottom: '5px' }}>
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
                    </div> */}

                    {/* <div {...neckSwipe} style={{ touchAction: 'pan-y', userSelect: 'none', cursor: 'grab', marginBottom: '5px' }}>
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
                    </div> */}

                    {/* bracelet */}
                    {/* <div {...braceletSwipe} style={{ touchAction: 'pan-y', userSelect: 'none', cursor: 'grab', marginBottom: '5px' }}>
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
                    </div> */}

                    {/* watch */}
                    {/* <div {...watchSwipe} style={{ touchAction: 'pan-y', userSelect: 'none', cursor: 'grab', marginBottom: '5px' }}>
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
                    </div> */}

                    {/* bag */}
                    <div {...bagSwipe} style={{ touchAction: 'pan-y', userSelect: 'none', cursor: 'grab', marginBottom: '5px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }} className='glass-card'>
                            {Array.from({ length: accessoryPageSize }).map((_, i) => {
                                if (loadingGarments) return <SkeletonCell key={i} style={{ marginTop: '5px', marginBottom: '5px' }} />;
                                const g = pagedBags[i];
                                return (
                                    <div key={i} onClick={() => g && (setSelectedBag(g), setSelectedOutfitIdx(null))} className="rounded-md overflow-hidden flex items-center justify-center" style={{ aspectRatio: '1/1', borderRadius: '4px', marginTop: '5px', marginBottom: '5px', cursor: g ? 'pointer' : 'default', border: (g && selectedBag?.id === g.id) ? '1.5px solid rgba(255,255,255,0.6)' : '1.5px solid transparent' }}>
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
                </div>
                <div className="flex flex-col gap-1">
                    <SectionTitle label="Outfit" />
                    <div {...outfitSwipe} style={{ touchAction: 'pan-y', userSelect: 'none', cursor: 'grab' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', rowGap: '10px', columnGap: '6px' }}>
                            {loadingOutfits
                                ? Array.from({ length: 4 }).map((_, i) => (
                                    <SkeletonCell key={i} ratio="3/5" style={{ borderRadius: '10px' }} />
                                  ))
                                : pagedOutfits.map((outfit, i) => {
                                    const globalIdx = outfitPage * outfitPageSize + i;
                                    return (
                                        <div key={outfit.id} onClick={() => selectOutfit(globalIdx)} style={{ position: 'relative', aspectRatio: '3/5', borderRadius: '10px', overflow: 'hidden', background: 'rgba(255,255,255,0.01)', cursor: 'pointer', border: selectedOutfitIdx === globalIdx ? '2px solid rgba(255,255,255,0.6)' : '2px solid transparent', transition: 'border-color 0.2s' }}>
                                            {outfit.file?.fileUrl
                                                ? <img src={outfit.file.fileUrl} alt={outfit.name} draggable={false} className="w-full h-full object-cover pointer-events-none" />
                                                : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px' }}>{outfit.name}</span></div>
                                            }
                                        </div>
                                    );
                                })
                            }
                        </div>
                        <div className="flex justify-center gap-1.5 pt-2">
                            {Array.from({ length: totalOutfitPages }).map((_, i) => (
                                <button key={i} type="button" onClick={() => setOutfitPage(i)} style={{ width: i === outfitPage ? 12 : 4, height: 4, borderRadius: '9999px', border: 'none', padding: 0, cursor: 'pointer', background: i === outfitPage ? 'white' : 'rgba(255,255,255,0.3)', transition: 'all 0.3s' }} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Center panel */}
            {(() => {
                const selectedOutfit = selectedOutfitIdx !== null ? (outfits[selectedOutfitIdx] ?? null) : null;
                return (
                    <div className="h-full flex flex-col items-center pt-8 gap-1 overflow-hidden" style={{ flex: '0 0 50%', width: '50%', minHeight: 0 }}>

                        {/* Outfit display */}
                        {selectedOutfit && (
                            <div style={{ width: '100%', padding: '0 12px', paddingBottom: '145px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '6px', overflow: 'hidden' }}>
                                {/* Image — proportional flex share, no fixed height */}
                                <div style={{ flex: '2 1 0', minHeight: 0, borderRadius: '12px', overflow: 'hidden', background: 'rgba(255,255,255,0.01)' }}>
                                    {selectedOutfit.file?.fileUrl
                                        ? <img src={selectedOutfit.file.fileUrl} alt={selectedOutfit.name} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
                                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px' }}>No Image</span></div>
                                    }
                                </div>
                                {/* Name & description — fixed, description clipped to 2 lines */}
                                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                    <span style={{ color: 'white', fontSize: '13px', fontWeight: 700, lineHeight: 1.3, overflow: 'hidden' }}>{selectedOutfit.name}</span>
                                    {selectedOutfit.description && (
                                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', lineHeight: 1.5, overflow: 'hidden', maxHeight: '3em' }}>{selectedOutfit.description}</span>
                                    )}
                                </div>
                                {/* Garment cards — remaining flex space, each card grows equally */}
                                {selectedOutfit.items.length > 0 && (
                                    <div style={{ flex: '3 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                                        {selectedOutfit.items.slice().sort((a, b) => {
                                            const UPPER = ['Shirt','TShirt','Polo','Blouse','Hoodie','Sweater','Jacket','Coat','Blazer'];
                                            const LOWER = ['Pants','Jeans','Shorts','Skirt'];
                                            const FOOT  = ['Shoes','Sneakers','Sandals','Boots','Heels','Socks'];
                                            const HEAD  = ['Hat','Beanie','Cap','Headband'];
                                            const rank = (types: string[]) => {
                                                const t = types[0] ?? '';
                                                if (UPPER.includes(t)) return 0;
                                                if (LOWER.includes(t)) return 1;
                                                if (FOOT.includes(t))  return 2;
                                                if (HEAD.includes(t))  return 3;
                                                return 4;
                                            };
                                            return rank(a.garment.garmentType) - rank(b.garment.garmentType);
                                        }).map((item) => (
                                            <div key={item.id} className='flex' style={{ flex: '1 1 0', minHeight: 0, width: '100%', alignItems: 'stretch', overflow: 'hidden', background: 'transparent' }}>
                                                <div style={{ flex: '0 0 38%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px 0 0 8px', overflow: 'hidden' }}>
                                                    {item.garment.imageUrl
                                                        ? <img src={item.garment.imageUrl} alt={item.garment.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />
                                                        : <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px' }}>No Image</span>
                                                    }
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0, padding: '5px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2px', overflow: 'hidden' }}>
                                                    <span style={{ color: 'rgba(255,255,255,255,0.01)', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', overflow: 'hidden', whiteSpace: 'nowrap' }}>{item.garment.garmentType[0]}</span>
                                                    <span style={{ color: 'white', fontSize: '10px', fontWeight: 600, lineHeight: 1.3, overflow: 'hidden' }}>{item.garment.name}</span>
                                                    <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '9px', lineHeight: 1.4, overflow: 'hidden' }}>{item.garment.description}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Garment slot cards */}
                        {!selectedOutfit && (
                            <div style={{ flex: 1, minHeight: 0, width: '100%', padding: '0 10px 88px', display: 'flex', flexDirection: 'column', gap: '6px', overflow: 'hidden', background: 'transparent' }}>
                                {[selectedHat, selectedBag, selectedTop, selectedBottom, selectedShoe]
                                    .filter((g): g is RemoteGarment => g !== null)
                                    .sort((a, b) => {
                                        const UPPER = ['Shirt','TShirt','Polo','Blouse','Hoodie','Sweater','Jacket','Coat','Blazer'];
                                        const LOWER = ['Pants','Jeans','Shorts','Skirt'];
                                        const FOOT  = ['Shoes','Sneakers','Sandals','Boots','Heels','Socks'];
                                        const HEAD  = ['Hat','Beanie','Cap','Headband'];
                                        const rank = (types: string[]) => {
                                            const t = types[0] ?? '';
                                            if (UPPER.includes(t)) return 0;
                                            if (LOWER.includes(t)) return 1;
                                            if (FOOT.includes(t))  return 2;
                                            if (HEAD.includes(t))  return 3;
                                            return 4;
                                        };
                                        return rank(a.garmentType) - rank(b.garmentType);
                                    })
                                    .map((g) => (
                                        <div key={g.id} className='flex' style={{ flexShrink: 0, height: '110px', width: '100%', alignItems: 'stretch', overflow: 'hidden' }}>
                                            <div style={{ flex: '0 0 38%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px 0 0 8px', overflow: 'hidden' }}>
                                                {g.imageUrl
                                                    ? <img src={g.imageUrl} alt={g.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />
                                                    : <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px' }}>No Image</span>
                                                }
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0, padding: '8px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '3px', overflow: 'hidden' }}>
                                                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em', overflow: 'hidden', whiteSpace: 'nowrap' }}>{g.garmentType[0]}</span>
                                                <span style={{ color: 'white', fontSize: '12px', fontWeight: 600, lineHeight: 1.3, overflow: 'hidden' }}>{g.name}</span>
                                                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '10px', lineHeight: 1.4, overflow: 'hidden' }}>{g.description}</span>
                                            </div>
                                        </div>
                                    ))
                                }
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* Right panel — Tops / Bottoms / Shoes */}
            <div className="h-full flex flex-col p-2 gap-2 min-h-0 overflow-hidden" style={{ flex: '0 0 25%', width: '25%' }}>
                <div className="flex flex-col gap-1">

                    <SectionTitle label="Tops" />
                    <div {...topsSwipe} style={{ touchAction: 'pan-y', userSelect: 'none', cursor: 'grab' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
                            {Array.from({ length: pageSize }).map((_, i) => {
                                if (loadingGarments) return <SkeletonCell key={i} />;
                                const g = pagedTops[i];
                                return (
                                    <div key={i} onClick={() => g && (setSelectedTop(g), setSelectedOutfitIdx(null))} className="rounded-md overflow-hidden flex items-center justify-center" style={{ aspectRatio: '1/1', borderRadius: '4px', cursor: g ? 'pointer' : 'default', border: (g && selectedTop?.id === g.id) ? '1.5px solid rgba(255,255,255,0.6)' : '1.5px solid transparent' }}>
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
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
                            {Array.from({ length: pageSize }).map((_, i) => {
                                if (loadingGarments) return <SkeletonCell key={i} />;
                                const g = pagedBottoms[i];
                                return (
                                    <div key={i} onClick={() => g && (setSelectedBottom(g), setSelectedOutfitIdx(null))} className="rounded-md overflow-hidden flex items-center justify-center" style={{ aspectRatio: '1/1', borderRadius: '4px', cursor: g ? 'pointer' : 'default', border: (g && selectedBottom?.id === g.id) ? '1.5px solid rgba(255,255,255,0.6)' : '1.5px solid transparent' }}>
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
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
                            {Array.from({ length: shoesPageSize }).map((_, i) => {
                                if (loadingGarments) return <SkeletonCell key={i} />;
                                const g = pagedShoes[i];
                                return (
                                    <div key={i} onClick={() => g && (setSelectedShoe(g), setSelectedOutfitIdx(null))} className="rounded-md overflow-hidden flex items-center justify-center" style={{ aspectRatio: '1/1', borderRadius: '4px', cursor: g ? 'pointer' : 'default', border: (g && selectedShoe?.id === g.id) ? '1.5px solid rgba(255,255,255,0.6)' : '1.5px solid transparent' }}>
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

        {/* Create Outfit — fixed to viewport bottom center, hidden when outfit is selected */}
        {selectedOutfitIdx === null && <button
            style={{
                position: 'fixed',
                bottom: '28px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 50,
                padding: '14px 52px',
                background: '#ffffff',
                color: '#000',
                border: 'none',
                borderRadius: '14px',
                fontSize: '16px',
                fontWeight: '700',
                cursor: 'pointer',
                letterSpacing: '0.4px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                transition: 'opacity 0.2s, transform 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            onMouseDown={e => (e.currentTarget.style.transform = 'translateX(-50%) scale(0.97)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'translateX(-50%) scale(1)')}
            onClick={() => setShowConfirm(true)}
        >
            Create Outfit
        </button>}

        {/* Confirm modal */}
        {showConfirm && (
            <div
                style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => setShowConfirm(false)}
            >
                <div
                    style={{ background: '#111', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '20px', padding: '32px 28px', width: '360px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}
                    onClick={e => e.stopPropagation()}
                >
                    <p style={{ color: 'white', fontSize: '20px', fontWeight: '700', textAlign: 'center', margin: 0 }}>Create Outfit?</p>
                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '14px', textAlign: 'center', margin: 0 }}>Save your current selection as a new outfit.</p>

                    {/* Outfit preview */}
                    <div style={{ width: '100%', aspectRatio: '2/3', borderRadius: '12px', overflow: 'hidden', background: '#f8f9fb', marginTop: '4px' }}>
                        <OutfitPreviewCanvas
                            hat={selectedHat}
                            top={selectedTop}
                            bottom={selectedBottom}
                            shoe={selectedShoe}
                            bag={selectedBag}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px', width: '100%' }}>
                        <button
                            style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', color: 'white', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}
                            onClick={() => setShowConfirm(false)}
                        >
                            Cancel
                        </button>
                        <button
                            style={{ flex: 1, padding: '12px', background: '#ffffff', border: 'none', borderRadius: '12px', color: '#000', fontSize: '15px', fontWeight: '700', cursor: 'pointer' }}
                            onClick={() => { setShowConfirm(false); /* TODO: save logic */ }}
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
    );
}
