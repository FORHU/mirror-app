"use client";

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import "../../styles/glow.css";
import { garmentService, type RemoteGarment } from '@/modules/shared/api/garment.service';
import { outfitService, type RemoteOutfit } from '@/modules/shared/api/outfit.service';
import { FittingSlot } from '@/modules/garment/types';
import WeatherWidget from '@/components/WeatherWidget';

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
    const [outfits, setOutfits] = useState<RemoteOutfit[]>([]);
    const [selectedOutfitIdx, setSelectedOutfitIdx] = useState<number | null>(null);
    const selectedOutfit = selectedOutfitIdx !== null ? (outfits[selectedOutfitIdx] ?? null) : null;
    const outfitPageSize = 8;
    const [outfitPage, setOutfitPage] = useState(0);
    const totalOutfitPages = Math.max(1, Math.ceil(outfits.length / outfitPageSize));
    const pagedOutfits = outfits.slice(outfitPage * outfitPageSize, (outfitPage + 1) * outfitPageSize);
    const outfitSwipe = useSwipe(
        () => setOutfitPage((p) => Math.min(p + 1, totalOutfitPages - 1)),
        () => setOutfitPage((p) => Math.max(p - 1, 0)),
    );
    const [isRecording, setIsRecording] = useState(false);
    const messages: { role: 'user' | 'ai'; text: string }[] = [{ role: 'ai', text: 'Hi! Ask me anything about your outfit today.' }];
    const chatEndRef = useRef<HTMLDivElement>(null);
    const now = useClock();
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
        outfitService.getAll()
            .then(setOutfits)
            .catch((err) => console.error('[Outfits] fetch error:', err));
    }, []);

    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const day  = now.toLocaleDateString([], { weekday: 'long' });
    const date = now.toLocaleDateString([], { month: 'long', day: 'numeric' });

    return (
    <div className="relative w-screen h-screen overflow-hidden bg-black flex flex-col">
        <header
            className={'flex items-center justify-between shrink-0 py-4 px-4'}
        >
            <WeatherWidget iconSize={32} />
            <span className="text-white font-semibold text-3xl tracking-wide select-none"> AI Recommendation</span>
            <button onClick={() => router.push('/logged-in')} className="p-4 transition-all hover:scale-105 active:scale-95">
                <ArrowLeft className="w-6 h-6 text-white" />
            </button>
        </header>
        <div className="flex flex-1 relative" style={{ height: '546px'}}>
            {/* Left panel — AI chat + Outfit grid */}
            <div className="flex-1 h-full flex flex-col p-2 gap-2 min-h-0">
                {/* AI Voice Chat */}
                <div className="flex flex-col glass-card-garment" style={{ height: '180px', overflow: 'hidden' }}>
                    {/* Messages */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {messages.map((msg, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                                <span style={{
                                    maxWidth: '85%',
                                    padding: '6px 10px',
                                    borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                                    background: msg.role === 'user' ? 'rgba(130,90,255,0.35)' : 'rgba(255,255,255,0.08)',
                                    color: 'rgba(255,255,255,0.85)',
                                    fontSize: '11px',
                                    lineHeight: 1.5,
                                }}>
                                    {msg.text}
                                </span>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>
                    {/* Record button */}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ flex: 1, color: isRecording ? 'rgba(255,140,140,0.8)' : 'rgba(255,255,255,0.3)', fontSize: '11px', transition: 'color 0.2s' }}>
                            {isRecording ? 'Listening...' : 'Tap mic to ask AI'}
                        </span>
                        <div style={{ position: 'relative', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {/* Ripple rings */}
                            {isRecording && (<>
                                <span className="animate-ping" style={{ position: 'absolute', width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,80,80,0.35)', animationDuration: '1s' }} />
                                <span className="animate-ping" style={{ position: 'absolute', width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,80,80,0.2)', animationDuration: '1s', animationDelay: '0.3s' }} />
                                <span className="animate-ping" style={{ position: 'absolute', width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,80,80,0.1)', animationDuration: '1s', animationDelay: '0.6s' }} />
                            </>)}
                            <button
                                onClick={() => setIsRecording((r) => !r)}
                                style={{
                                    position: 'relative', zIndex: 1,
                                    width: '36px', height: '36px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                                    background: isRecording ? 'rgba(255,80,80,0.85)' : 'rgba(130,90,255,0.5)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'background 0.2s',
                                }}
                            >
                                {isRecording ? (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                                ) : (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                                        <line x1="12" y1="19" x2="12" y2="23"/>
                                        <line x1="8" y1="23" x2="16" y2="23"/>
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-1" style={{ flex: 1, minHeight: 0 }}>
                    <SectionTitle label="Outfit" />
                    <div {...outfitSwipe} style={{ touchAction: 'pan-y', userSelect: 'none', cursor: 'grab' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', rowGap: '10px', columnGap: '6px' }}>
                            {pagedOutfits.map((outfit, i) => {
                                const globalIdx = outfitPage * outfitPageSize + i;
                                return (
                                    <div key={outfit.id} onClick={() => setSelectedOutfitIdx(globalIdx)} style={{ position: 'relative', aspectRatio: '3/5', borderRadius: '10px', overflow: 'hidden', background: 'rgba(255,255,255,0.02)', cursor: 'pointer', border: selectedOutfitIdx === globalIdx ? '2px solid rgba(255,255,255,0.6)' : '2px solid transparent', transition: 'border-color 0.2s' }}>
                                        {outfit.file?.fileUrl
                                            ? <img src={outfit.file.fileUrl} alt={outfit.name} draggable={false} className="w-full h-full object-cover pointer-events-none" />
                                            : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px' }}>{outfit.name}</span></div>
                                        }
                                        <button onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.35)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                            </svg>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex justify-center gap-1.5 pt-2">
                            {Array.from({ length: totalOutfitPages }).map((_, i) => (
                                <button key={i} type="button" onClick={() => setOutfitPage(i)} style={{ width: i === outfitPage ? 12 : 4, height: 4, borderRadius: '9999px', border: 'none', padding: 0, cursor: 'pointer', background: i === outfitPage ? 'white' : 'rgba(255,255,255,0.3)', transition: 'all 0.3s' }} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Center panel — wider now */}
            <div className="flex-[2] h-full flex flex-col items-center justify-start pt-8 gap-1">
                <span className="text-white font-thin select-none" style={{ fontSize: '3rem', lineHeight: 1 }}>{time}</span>
                <span className="text-white/80 text-xl font-light select-none mb-4">{day}, {date}</span>
            </div>

            {/* Outfit Details sidebar — slides in from right */}
            <div style={{
                position: 'absolute', bottom: 0, right: 0, height: '75%', width: '220px',
                background: 'rgba(0,0,0,0.35)',
                backdropFilter: 'blur(16px)',
                display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px',
                transform: selectedOutfitIdx === null ? 'translateX(100%)' : 'translateX(0)',
                transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
                zIndex: 20, overflow: 'hidden',
            }}>
                {/* Header — fixed */}
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <SectionTitle label="Outfit Details" />
                    <button onClick={() => setSelectedOutfitIdx(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0 4px' }}>✕</button>
                </div>
                {/* Garment cards — proportional flex, each shares available space equally */}
                <div style={{ flex: '3 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                    {(selectedOutfit?.items ?? []).slice().sort((a, b) => {
                        const UPPER  = ['Shirt','TShirt','Polo','Blouse','Hoodie','Sweater','Jacket','Coat','Blazer'];
                        const LOWER  = ['Pants','Jeans','Shorts','Skirt'];
                        const FOOT   = ['Shoes','Sneakers','Sandals','Boots','Heels','Socks'];
                        const HEAD   = ['Hat','Beanie','Cap','Headband'];
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
                        <div key={item.id} className='flex glass-card-garment' style={{ flex: '1 1 0', minHeight: 0, width: '100%', alignItems: 'stretch', overflow: 'hidden' }}>
                            <div style={{ flex: '0 0 40%', background: 'rgba(255,255,255,0.01)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px 0 0 8px', overflow: 'hidden' }}>
                                {item.garment.imageUrl
                                    ? <img src={item.garment.imageUrl} alt={item.garment.name} draggable={false} className="w-full h-full object-contain pointer-events-none" />
                                    : <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px' }}>Img</span>
                                }
                            </div>
                            <div style={{ flex: 1, minWidth: 0, padding: '5px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2px', overflow: 'hidden' }}>
                                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', overflow: 'hidden', whiteSpace: 'nowrap' }}>{item.garment.garmentType[0]}</span>
                                <span style={{ color: 'white', fontSize: '10px', fontWeight: 600, lineHeight: 1.3, overflow: 'hidden' }}>{item.garment.name}</span>
                                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '9px', lineHeight: 1.4, overflow: 'hidden' }}>{item.garment.description}</span>
                            </div>
                        </div>
                    ))}
                </div>
                {/* Why this look? — fixed at bottom */}
                <div className='glass-card-garment' style={{ flex: '1 1 0', minHeight: 0, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px', overflow: 'hidden' }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', flexShrink: 0 }}>Why This Look?</span>
                    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                        {[
                            'Light and breathable for high humidity',
                            'Neutral tones that don\'t trap heat',
                            'Easy to move in for daily activities',
                            'Effortless style with trendy touches',
                        ].map((reason) => (
                            <div key={reason} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', flex: '1 1 0', minHeight: 0, overflow: 'hidden' }}>
                                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '10px', lineHeight: 1, paddingTop: '2px', flexShrink: 0 }}>✓</span>
                                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', lineHeight: 1.4, overflow: 'hidden' }}>{reason}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

        </div>
    </div>
    );
}
