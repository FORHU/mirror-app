"use client";

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import PersonalizeOutfitCard from '@/components/PersonalizeOutfitCard';
import "../../styles/glow.css";


export default function PersonalizeOutfit() {
    const router = useRouter();

    return (
        <>
            <div className="relative w-screen h-screen overflow-hidden bg-black flex flex-col">
                <header
                    className={'flex items-center justify-between shrink-0 py-4 px-4'}
                    style={{ background: 'rgba(0,0,0,0.85)' }}
                >
                    <button onClick={() => router.push('/logged-in')} className="p-4 transition-all hover:scale-105 active:scale-95">
                        <ArrowLeft className="w-6 h-6 text-white" />
                    </button>
                </header>
                <div className='flex items-center justify-center' style={{ height: '100%' }}>
                    <div className='flex items-center justify-center' style={{height: '400px', width: '400px' }}>
                        <PersonalizeOutfitCard />
                    </div>
                </div>
            </div>
        </>
    );
}
