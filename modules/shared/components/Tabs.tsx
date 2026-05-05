"use client";

import React, { useState } from "react";
import { cn } from "@/modules/shared/utils";

export interface TabItem {
  id: string;
  label: string;
  content: React.ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  defaultOpenId?: string;
  className?: string;
}

export const Tabs = ({ items, defaultOpenId, className }: TabsProps) => {
  const [activeTab, setActiveTab] = useState(defaultOpenId || items[0]?.id);

  if (!items.length) return null;

  return (
    <div className={cn("w-full", className)}>
      <div className="flex w-full overflow-x-auto border-b border-border-default no-scrollbar">
        {items.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap focus:outline-none",
              activeTab === tab.id
                ? "text-brand-vibrant"
                : "text-text-secondary hover:text-text-primary",
            )}
            role="tab"
            aria-selected={activeTab === tab.id}
          >
            {tab.label}
            {/* Animated Active Indicator */}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-vibrant origin-center animate-in fade-in slide-in-from-bottom-1 duration-200" />
            )}
          </button>
        ))}
      </div>

      <div className="pt-4" role="tabpanel">
        {items.find((item) => item.id === activeTab)?.content}
      </div>
    </div>
  );
};
