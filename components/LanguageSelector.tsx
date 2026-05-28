"use client";

import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";
import { Globe } from "lucide-react";
import { useState } from "react";

const LANGUAGES = [
  { code: "en-US", label: "English" },
  { code: "fr-FR", label: "French" },
  { code: "ko-KR", label: "Korean" },
];

export function LanguageSelector() {
  const { voiceLanguage, setVoiceLanguage } = useMirrorStore();
  const [open, setOpen] = useState(false);

  const activeLang =
    LANGUAGES.find((l) => l.code === voiceLanguage) || LANGUAGES[0];

  return (
    <div className="relative inline-block ml-4 z-50">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md px-3 py-1.5 rounded-full transition-all text-white text-sm font-medium"
      >
        <Globe className="w-4 h-4" />
        {activeLang.label}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 bg-black/80 border border-white/20 backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl min-w-[100px]">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={(e) => {
                e.stopPropagation();
                setVoiceLanguage(lang.code);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                voiceLanguage === lang.code
                  ? "bg-white/20 text-white font-bold"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
