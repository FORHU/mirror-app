"use client";

import { ShirtIcon, Calendar, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';
import '../../styles/glow.css';
import { useAuthStore } from '@/modules/shared/store/useAuthStore';

export default function LoggedInPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const displayName = user?.displayName || user?.username || user?.email || 'User';

  return (
    <div className="w-screen h-screen bg-black flex flex-col overflow-hidden px-10 py-10">

      {/* Header */}
      <div className="flex items-center justify-between mb-10 shrink-0 py-4">
        <div>
          <h2 className="text-white font-bold text-3xl tracking-tight">Hi, {displayName}!</h2>
        </div>
        <button className="logout-btn px-8 py-3 text-white text-lg font-medium">
          Logout
        </button>
      </div>

      {/* Main Heading */}
      <div className="text-center mb-10 shrink-0">
        <h1 className="text-white font-bold text-5xl tracking-tight mb-3">
          What are you here for?
        </h1>
        <p className="text-white/40 text-xl">Choose to get started</p>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-5 flex-1 min-h-0">

        {/* Check a fit */}
        <button
          onClick={() => router.push('/personalize-outfit')}
          className="glass-card-strong neon-border-white rounded-3xl py-8 h-40 flex flex-col items-center justify-center gap-5 transition-all active:scale-95"
          style={{height: '250px'}}
        >
          <div className="icon-spotlight">
            <div className="icon-box ">
              <ShirtIcon className="w-11 h-11 text-white " strokeWidth={1.5} />
            </div>
          </div>
          <div className="text-center">
            <h3 className="text-white font-bold text-2xl mb-2">Check a fit</h3>
            <p className="text-white/45 text-lg">Just try on clothes and see how they look</p>
          </div>
        </button>

        {/* Dress for the vibe */}
        <button
          onClick={() => router.push('/personalize-outfit')}
          className="glass-card-strong neon-border-white glow-white rounded-3xl py-8 h-40 flex flex-col items-center justify-center gap-5 transition-all active:scale-95"
          style={{height: '250px'}}
        >
          <div className="icon-spotlight">
            <div className="icon-box ">
              <Calendar className="w-11 h-11 text-white" strokeWidth={1.5} />
            </div>
          </div>
          <div className="text-center">
            <h3 className="text-white font-bold text-2xl mb-2">Dress for the vibe</h3>
            <p className="text-white/45 text-lg">Outfit matched to your mood and location</p>
          </div>
        </button>

        {/* Explore the map */}
        <button
          onClick={() => router.push('/map')}
          className="glass-card-strong neon-border-white rounded-3xl py-8 h-40 flex flex-col items-center justify-center gap-5 transition-all active:scale-95"
          style={{height: '250px'}}
        >
          <div className="icon-spotlight">
            <div className="icon-box">
              <MapPin className="w-11 h-11 text-white" strokeWidth={1.5} />
            </div>
          </div>
          <div className="text-center">
            <h3 className="text-white font-bold text-2xl mb-2">Explore the map</h3>
            <p className="text-white/45 text-lg">Navigate, check weather, and discover nearby places</p>
          </div>
        </button>

      </div>

      {/* Bottom breathing room */}
      <div className="h-10 shrink-0" />

    </div>
  );
}
