"use client";

import { usePathname, useRouter } from 'next/navigation';
import { Sparkles, CalendarDays, Shirt } from 'lucide-react';
import { useAuthStore } from '@/modules/shared/store/useAuthStore';

const TABS = [
  { label: 'Stylist', icon: Sparkles,     href: '/outfit-builder' },
  { label: 'Calendar', icon: CalendarDays, href: '/calendar' },
  { label: 'Wardrobe', icon: Shirt,        href: '/outfit-builder' },
] as const;

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore(s => s.user);

  const initial = (user?.displayName ?? user?.username ?? 'U')[0].toUpperCase();

  return (
    <div className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-100 flex items-center px-2 pb-2 pt-1">
      {/* User avatar */}
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center text-white text-sm font-bold mr-1 shrink-0">
        {initial}
      </div>

      {/* Tabs */}
      {TABS.map(({ label, icon: Icon, href }) => {
        const isActive = pathname === href;

        return (
          <button
            key={label}
            onClick={() => router.push(href)}
            className={`flex-1 flex flex-col items-center py-1.5 gap-0.5 transition-colors ${
              isActive ? 'text-[#8b7fc7]' : 'text-gray-400'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{label}</span>
            {isActive && (
              <div className="w-4 h-0.5 rounded-full bg-[#8b7fc7]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
