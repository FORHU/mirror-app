"use client";

import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";
import { Globe } from "lucide-react";
import { useState } from "react";

const LANGUAGES = [
  { code: "en-US", label: "English" },
  { code: "en-GB", label: "English (UK)" },
  { code: "en-AU", label: "English (AU)" },
  { code: "en-IN", label: "English (IN)" },
  { code: "en-SG", label: "English (SG)" },
  { code: "en-NZ", label: "English (NZ)" },
  { code: "en-ZA", label: "English (ZA)" },
  { code: "en-IE", label: "English (IE)" },
  { code: "fr-FR", label: "French" },
  { code: "fr-CA", label: "French (CA)" },
  { code: "fr-BE", label: "French (BE)" },
  { code: "de-DE", label: "German" },
  { code: "de-AT", label: "German (AT)" },
  { code: "de-CH", label: "German (CH)" },
  { code: "es-ES", label: "Spanish" },
  { code: "es-MX", label: "Spanish (MX)" },
  { code: "es-US", label: "Spanish (US)" },
  { code: "it-IT", label: "Italian" },
  { code: "pt-BR", label: "Portuguese (BR)" },
  { code: "pt-PT", label: "Portuguese (PT)" },
  { code: "nl-NL", label: "Dutch" },
  { code: "nl-BE", label: "Dutch (BE)" },
  { code: "pl-PL", label: "Polish" },
  { code: "ru-RU", label: "Russian" },
  { code: "sv-SE", label: "Swedish" },
  { code: "da-DK", label: "Danish" },
  { code: "nb-NO", label: "Norwegian" },
  { code: "fi-FI", label: "Finnish" },
  { code: "cs-CZ", label: "Czech" },
  { code: "ro-RO", label: "Romanian" },
  { code: "tr-TR", label: "Turkish" },
  { code: "ca-ES", label: "Catalan" },
  { code: "cy-GB", label: "Welsh" },
  { code: "is-IS", label: "Icelandic" },
  { code: "ja-JP", label: "Japanese" },
  { code: "ko-KR", label: "Korean" },
  { code: "cmn-CN", label: "Chinese (Mandarin)" },
  { code: "yue-CN", label: "Chinese (Cantonese)" },
  { code: "hi-IN", label: "Hindi" },
  { code: "arb", label: "Arabic" },
  { code: "ar-AE", label: "Arabic (Gulf)" },
];

export function LanguageSelector() {
  const { voiceLanguage, setVoiceLanguage } = useMirrorStore();
  const [open, setOpen] = useState(false);

  const activeLang =
    LANGUAGES.find((l) => l.code === voiceLanguage) || LANGUAGES[0];

  return (
    <div className="relative inline-block z-50">
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
