import { ROUTES } from "@/navigation";

/**
 * Deterministic, on-device navigation resolver.
 *
 * Why this exists: the external ChatWonder agent is a fashion/styling persona
 * and does NOT understand navigation intents — asking it to "go to cosmetics"
 * returns intent "NONE" with no [NAV_DATA] block, so the kiosk never moves.
 * Instead of depending on that agent, we resolve "[nav]" requests here, against
 * the app's real ROUTES, before ever calling ChatWonder. Reliable, instant, and
 * free (no external AI round-trip).
 *
 * Flow: input -> resolveNav() -> { target_url } -> page.tsx router.push().
 * Non-navigation input returns null and falls through to ChatWonder as before.
 */

type NavTarget = {
  route: string;
  label: string; // spoken/displayed name, e.g. "opening Cosmetics"
  aliases: string[]; // lowercase keywords that map to this route
};

// Order matters: list more specific targets before broad ones (e.g. put
// "home screen" before bare "home" only if they diverge — here single list is
// fine because we match whole words). Aliases are matched as whole words.
const NAV_TARGETS: NavTarget[] = [
  {
    route: ROUTES.AI_ASSISTANT,
    label: "the AI Assistant",
    aliases: ["ai assistant", "assistant", "ai chat", "voice assistant"],
  },
  {
    route: ROUTES.AI_RECOMMENDATION_COSMETIC,
    label: "Cosmetics",
    aliases: [
      "cosmetic",
      "cosmetics",
      "makeup",
      "make up",
      "beauty",
      "skincare",
      "skin care",
      "lipstick",
    ],
  },
  {
    route: ROUTES.AI_RECOMMENDATION_FASHION,
    label: "Fashion",
    aliases: [
      "fashion",
      "outfit",
      "outfits",
      "clothes",
      "clothing",
      "garment",
      "garments",
      "apparel",
      "wardrobe",
      "style recommendation",
    ],
  },
  {
    route: ROUTES.MAP,
    label: "the Map",
    aliases: ["map", "maps", "directions", "store map", "where am i"],
  },
  {
    route: ROUTES.OVERVIEW,
    label: "the Overview",
    aliases: ["overview", "dashboard", "summary"],
  },
  {
    route: ROUTES.MIRROR_TEMPLATES,
    label: "Mirror Templates",
    aliases: ["template", "templates", "mirror template", "mirror templates"],
  },
  {
    route: ROUTES.QRCODE,
    label: "the QR Code",
    aliases: ["qr", "qr code", "qrcode", "scan", "scan code"],
  },
  {
    route: ROUTES.SELECT_GENDER,
    label: "Select Gender",
    aliases: ["select gender", "gender", "change gender"],
  },
  {
    route: ROUTES.WELCOME,
    label: "Home",
    aliases: ["home", "welcome", "start", "main menu", "landing", "go back"],
  },
];

// Verbs/phrases that signal a navigation request. Required (unless the message
// is explicitly tagged "[nav]") so we never hijack a styling question like
// "what cosmetics suit me" or "rate my outfit".
// Deliberately high-precision: unambiguous "movement" verbs only. We exclude
// "show me" so styling asks like "show me an outfit" still reach ChatWonder.
const NAV_VERBS =
  /\b(go to|goto|go back|navigate to|navigate|open|take me to|bring me to|switch to|jump to|head to|move to|let'?s go to|i want to (?:go|open)|can you (?:go|open))\b/i;

// Leading "[nav]" marker the kiosk can prepend to force navigation handling.
const NAV_TAG = /^\s*\[nav\]\s*/i;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type NavResolution = {
  target_url: string;
  label: string;
  matched: string; // which alias matched (handy for logging/debug)
} | null;

/**
 * Resolve a navigation target from raw user input.
 * Returns null when the input is not a navigation command.
 */
export function resolveNav(rawInput: string): NavResolution {
  if (!rawInput || !rawInput.trim()) return null;

  const tagged = NAV_TAG.test(rawInput);
  const text = rawInput
    .replace(NAV_TAG, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Gate: an explicit [nav] tag OR a navigation verb must be present.
  if (!tagged && !NAV_VERBS.test(text)) return null;

  for (const target of NAV_TARGETS) {
    for (const alias of target.aliases) {
      const re = new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i");
      if (re.test(text)) {
        return {
          target_url: target.route,
          label: target.label,
          matched: alias,
        };
      }
    }
  }

  return null;
}
