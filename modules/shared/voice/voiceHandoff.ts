/**
 * Cross-page handoff detection — pure functions used by VoiceProvider to decide
 * whether a transcript should navigate to a different feature page.
 */

export function isFashionHandoffPrompt(text: string): boolean {
  return /\b(outfit|fashion|clothing|what to wear|what should i wear|suggest.*outfit|recommend.*outfit|full look|complete look|full.*outfit|dress.*for|style.*for my|outfit.*for my|outfit.*for the|wardrobe)\b/i.test(
    text,
  );
}

export function isCosmeticHandoffPrompt(text: string): boolean {
  return /(cosmetic|makeup|make-up|skincare|skin care|foundation|moisturize|moisturizer|moisturizing|moisturized|moisture|lipstick|sunscreen|serum|cleanser|toner|blush|concealer|spf|lotion|facial|eyeshadow|eye shadow|eyeliner|eye liner|lip gloss|lipgloss|lip balm|retinol|hyaluronic|niacinamide|exfoliate|exfoliating|exfoliant|exfoliation|acne|primer|essence|bb cream|cc cream|eye cream|face wash|face mask|face cream|sheet mask|clay mask|cream|mask|face oil|facial oil|skin oil|hair oil|body oil)\b/i.test(
    text,
  );
}

export function isMapDiscoveryPrompt(text: string): boolean {
  return /\b(things? to do|places? to (?:visit|go|see|explore|check out)|(?:suggest|recommend|find me?)\s+(?:a |some |me )?(?:fun|nice|good|cool|great|interesting|nearby)?\s*(?:place|spot|somewhere|destination)|where (?:can|should) i (?:go|visit|explore|hang out)|fun places?|good places?|nice places?|plan (?:my |the |a )?(?:full |)route|back-to-back schedule|route for the day|plan my (?:full |)day|fastest route|show me (?:the )?(?:fastest|quickest|shortest) route)\b/i.test(
    text,
  );
}

/**
 * Returns true when a prompt spans two or more intent domains (fashion + cosmetics
 * + location). These "lifestyle" prompts should route to /overview so all three
 * feature areas respond together rather than one winning the single-domain race.
 */
export function isLifestylePrompt(text: string): boolean {
  // Fashion signal: existing handoff keywords OR look-based aesthetic phrases
  const hasFashion =
    isFashionHandoffPrompt(text) ||
    /\b(?:lazy|clean girl|aesthetic|casual|everyday|day|night)\s+(?:day\s+)?look\b/i.test(text);

  // Cosmetics/skincare signal: existing handoff keywords OR "glow-up", "care for skin"
  const hasCosmetics =
    isCosmeticHandoffPrompt(text) ||
    /\bglow.?up\b|\bcare for (?:my |the )?skin\b/i.test(text);

  // Place/location signal: going somewhere, place suggestions, or daily planning
  const hasPlace =
    /\bsomewhere[ \w]*to go\b|\bwhere to go\b|\bplace suggestions?\b|\bplaces? (?:to (?:visit|go|explore|see)|i should)\b|\bplan (?:a |my )?day\b/i.test(
      text,
    );

  return [hasFashion, hasCosmetics, hasPlace].filter(Boolean).length >= 2;
}
