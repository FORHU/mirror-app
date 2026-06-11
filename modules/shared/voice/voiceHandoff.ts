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
  return /(cosmetic|makeup|make-up|skincare|skin care|foundation|moisturi|lipstick|sunscreen|serum|cleanser|toner|blush|concealer|spf|lotion|facial|eyeshadow|eye shadow|eyeliner|eye liner|lip gloss|lipgloss|lip balm|retinol|hyaluronic|niacinamide|exfoliat|acne|primer|essence|bb cream|cc cream|eye cream|face wash|face mask|face cream|sheet mask|clay mask|cream|mask|face oil|facial oil|skin oil|hair oil|body oil)\b/i.test(
    text,
  );
}

export function isMapDiscoveryPrompt(text: string): boolean {
  return /\b(things? to do|places? to (?:visit|go|see|explore|check out)|(?:suggest|recommend|find me?)\s+(?:a |some |me )?(?:fun|nice|good|cool|great|interesting|nearby)?\s*(?:place|spot|somewhere|destination)|where (?:can|should) i (?:go|visit|explore|hang out)|fun places?|good places?|nice places?|plan (?:my |the |a )?(?:full |)route|back-to-back schedule|route for the day|plan my (?:full |)day|fastest route|show me (?:the )?(?:fastest|quickest|shortest) route)\b/i.test(
    text,
  );
}
