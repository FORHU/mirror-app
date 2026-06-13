export const COSMETIC_PROMPT_KEY = "mirror_cosmetic_prompt";
export const COSMETIC_EVALUATE_KEY = "mirror_cosmetic_evaluate";

export type SkinTypeKey = "OILY" | "DRY" | "NORMAL" | "SENSITIVE";

export interface SkinTypeFilter {
  label: string;
  blurb: string;
  /** Allowed product `type` values; "all" admits every type. */
  types: string[] | "all";
  /** Allowed finishes — products tagged with a different finish are excluded. */
  finishes: string[];
}

export const SKIN_TYPE_FILTERS: Record<SkinTypeKey, SkinTypeFilter> = {
  OILY: {
    label: "Oily",
    blurb: "Shine control, matte & natural finishes",
    types: [
      "CLEANSER",
      "TONER",
      "EXFOLIANT",
      "POWDER",
      "SETTING_SPRAY",
      "SUNSCREEN",
      "PRIMER",
    ],
    finishes: ["MATTE", "NATURAL"],
  },
  DRY: {
    label: "Dry",
    blurb: "Hydration boost, dewy & natural finishes",
    types: [
      "MOISTURIZER",
      "SERUM",
      "ESSENCE",
      "CLEANSER",
      "SUNSCREEN",
      "PRIMER",
    ],
    finishes: ["DEWY", "NATURAL"],
  },
  NORMAL: {
    label: "Normal",
    blurb: "Balanced care, every finish works",
    types: "all",
    finishes: ["MATTE", "NATURAL", "DEWY"],
  },
  SENSITIVE: {
    label: "Sensitive",
    blurb: "Gentle formulas, dewy & natural finishes",
    types: ["MOISTURIZER", "SERUM", "ESSENCE", "CLEANSER", "SUNSCREEN"],
    finishes: ["DEWY", "NATURAL"],
  },
};

const KNOWN_FINISHES = ["MATTE", "DEWY", "NATURAL"];

/** Finish tag carried by the product, if any (matched case-insensitively). */
function productFinish(tags: string[]): string | null {
  for (const tag of tags) {
    const normalized = tag.trim().toUpperCase();
    if (KNOWN_FINISHES.includes(normalized)) return normalized;
  }
  return null;
}

export function matchesSkinType(
  product: { type: string | null; tags: string[] },
  skinType: SkinTypeKey,
): boolean {
  const filter = SKIN_TYPE_FILTERS[skinType];
  const type = product.type
    ?.trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  const typeOk =
    filter.types === "all" || (!!type && filter.types.includes(type));
  if (!typeOk) return false;
  // Products without an explicit finish tag pass; a tagged finish must be allowed.
  const finish = productFinish(product.tags ?? []);
  return !finish || filter.finishes.includes(finish);
}
