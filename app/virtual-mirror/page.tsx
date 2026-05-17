"use client";

import { useEffect, useRef, useState } from 'react';
import { Menu, ArrowLeft, X, Shirt, Layers, Footprints, Watch, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { LucideIcon } from 'lucide-react';
import "../../styles/glow.css";
import { garmentService, type RemoteGarment } from '@/modules/shared/api/garment.service';
import { FittingSlot } from '@/modules/garment/types';

type Category = {
  name: string;
  path: string;
  icon: LucideIcon;
  slots: FittingSlot[];
  available: boolean;
};

const categories: Category[] = [
  {
    name: 'Upper Garments',
    path: 'upper-garment',
    icon: Shirt,
    slots: [FittingSlot.UpperGarment, FittingSlot.FullGarment],
    available: true,
  },
  {
    name: 'Lower Garments',
    path: 'lower-garment',
    icon: Layers,
    slots: [FittingSlot.LowerGarment],
    available: true,
  },
  {
    name: 'Footwear',
    path: 'footwear',
    icon: Footprints,
    slots: [FittingSlot.FootGarment],
    available: true,
  },
  {
    name: 'Accessories',
    path: 'accessories',
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
    name: 'Full Outfit',
    path: 'full-outfit',
    icon: Sparkles,
    slots: [],
    available: false,
  },
];

export default function VirtualMirror() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [garments, setGarments] = useState<RemoteGarment[]>([]);
  const [loading, setLoading] = useState(false);

  async function selectCategory(category: Category) {
    if (!category.available) return;
    setIsMenuOpen(false);
    setActiveCategory(category);
    setGarments([]);
    setLoading(true);
    try {
      const results = await Promise.all(category.slots.map(s => garmentService.getBySlot(s)));
      setGarments(results.flat());
    } catch {
      setGarments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        // camera unavailable — mirror shows black
      }
    }
    startCamera();
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

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
        className={`absolute top-0 inset-x-0 z-20 flex items-center justify-between shrink-0 py-4 px-4 transition-opacity duration-300 ${isMenuOpen || activeCategory ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 100%)' }}
      >
        <button onClick={() => setIsMenuOpen(true)} className="p-4 transition-all hover:scale-105 active:scale-95">
          <Menu className="w-6 h-6 text-white" />
        </button>
        <span className="text-white font-semibold text-3xl tracking-wide select-none">Virtual Mirror</span>
        <button onClick={() => router.push('/logged-in')} className="p-4 transition-all hover:scale-105 active:scale-95">
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
      </header>

      {/* Sidebar overlay */}
      <div className={`fixed inset-0 z-50 transition-opacity duration-300 ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/20" onClick={() => setIsMenuOpen(false)} />

        <div
          className={`absolute top-0 left-0 h-full w-[384px] transition-all duration-300 ease-out ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
          style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(5px)', borderRight: '1px solid rgba(255,255,255,0.15)' }}
        >
          <div className="flex flex-col h-full w-full p-6">

            <div className="flex items-center justify-between mb-8 mt-14">
              <h3 className="text-white text-2xl font-semibold">Menu</h3>
              <button onClick={() => setIsMenuOpen(false)} className="transition-all hover:scale-110 active:scale-95">
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
                    className={`flex items-center gap-4 px-2 py-5 text-left transition-all active:scale-95 ${i !== 0 ? 'border-t border-white/10' : ''} ${category.available ? 'hover:bg-white/10' : 'opacity-35 cursor-not-allowed'}`}
                  >
                    <Icon className="w-6 h-6 text-white/60 shrink-0" strokeWidth={1.5} />
                    <span className="text-white font-medium text-lg">{category.name}</span>
                    {!category.available && <span className="ml-auto text-white/30 text-xs">Soon</span>}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-white/10">
              <p className="text-white/30 text-sm text-center">Select a category</p>
            </div>

          </div>
        </div>
      </div>

      {/* Category full-screen overlay */}
      <div
        className={`absolute inset-0 z-40 flex flex-col transition-opacity duration-300 ${activeCategory ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.55)' }}
      >
        {/* Top bar */}
        <div
          className="flex items-center justify-between shrink-0 py-4 px-10"
          style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)' }}
        >
          <button onClick={() => setActiveCategory(null)} className="p-4 transition-all hover:scale-105 active:scale-95">
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <span className="text-white font-semibold text-3xl tracking-wide select-none">
            {activeCategory?.name}
          </span>
          <div className="w-14" />
        </div>

        {/* Garment grid */}
        <div className="flex-1 overflow-y-auto px-6 pb-8">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-12 h-12 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          ) : garments.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-white/30 text-xl">No garments found</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', paddingTop: '24px' }}>
              {garments.map(garment => (
                <button
                  key={garment.id}
                  style={{ aspectRatio: '3/4', borderRadius: '12px', overflow: 'hidden', background: 'transparent', display: 'block' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={+garment.imageUrl}
                    alt={garment.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
