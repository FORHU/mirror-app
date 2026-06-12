import {
  getToday,
  nextWeekday,
  type PromptCategory,
} from "@/components/QuickResponseChips";
import { ROUTES } from "@/navigation";

export function getAssistantChipCategories(): PromptCategory[] {
  return [
    {
      label: "Fashion",
      icon: "👗",
      route: ROUTES.AI_RECOMMENDATION_FASHION,
      prompts: [
        `What should I wear today? It's ${getToday()} and I want something stylish but comfortable.`,
        `I have an event this ${nextWeekday(5)} — build me a full outfit from head to toe.`,
        `Give me a simple but attractive everyday look.`,
      ],
    },
    {
      label: "Skincare",
      icon: "✨",
      route: ROUTES.AI_RECOMMENDATION_COSMETIC,
      prompts: [
        `My skin feels dull lately — what skincare routine should I follow?`,
        `Recommend a simple morning and night skincare routine for normal skin.`,
        `What are the best products to improve my skin texture and glow?`,
      ],
    },
  ];
}
