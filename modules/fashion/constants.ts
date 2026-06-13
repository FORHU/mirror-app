export const FASHION_PROMPT_KEY = "mirror_fashion_prompt";

export function normalizeGender(value: unknown): "MALE" | "FEMALE" | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toUpperCase();
  if (["MALE", "MAN", "MEN", "M"].includes(v)) return "MALE";
  if (["FEMALE", "WOMAN", "WOMEN", "F"].includes(v)) return "FEMALE";
  return null;
}

export const FASHION_DEFAULT_RECOMMENDATION_PROMPT =
  "Recommend an outfit based on my current weather and location.";

export const FASHION_CATEGORY_PROMPTS: Partial<Record<string, string[]>> = {
  Casual: [
    "I'm looking for casual outfit recommendations. Suggest something relaxed and everyday that fits the current weather.",
    "Give me casual outfit ideas — comfortable, laid-back styles suited to today's conditions.",
    "Recommend a casual look I can wear today. Keep it relaxed and weather-appropriate.",
    "I want casual fashion recommendations. What casual outfits work best for today's weather?",
  ],
  Formal: [
    "I'm looking for formal outfit recommendations. Suggest something polished and professional for today's weather.",
    "Give me formal outfit ideas — elegant and refined styles suited to the current conditions.",
    "Recommend a formal look I can wear today. Something sophisticated and weather-appropriate.",
    "I want formal fashion recommendations. What formal outfits work best for today's weather?",
  ],
  Outdoor: [
    "I'm looking for outdoor outfit recommendations. Suggest something practical and activity-ready for today's weather.",
    "Give me outdoor outfit ideas — functional and weather-appropriate styles for spending time outside.",
    "Recommend an outdoor look I can wear today. Something built for the current conditions.",
    "I want outdoor fashion recommendations. What outfits work best for being outside in today's weather?",
  ],
};

/** Style quotes cycled on the fashion loading screen while the AI composes outfits. */
export const FASHION_QUOTES = [
  {
    text: "Fashion fades, only style remains the same.",
    author: "Coco Chanel",
  },
  {
    text: "You can have anything you want in life if you dress for it.",
    author: "Edith Head",
  },
  {
    text: "Style is knowing who you are, what you want to say, and not giving a damn.",
    author: "Gore Vidal",
  },
  {
    text: "Clothes mean nothing until someone lives in them.",
    author: "Marc Jacobs",
  },
  {
    text: "Fashion should be a form of escapism, and not a form of imprisonment.",
    author: "Alexander McQueen",
  },
  {
    text: "Luxury must be comfortable, otherwise it is not luxury.",
    author: "Coco Chanel",
  },
  {
    text: "Fashion is about dressing according to what's fashionable. Style is more about being yourself.",
    author: "Oscar de la Renta",
  },
  {
    text: "Personal style is about taking risks, trying something unexpected, and having fun with fashion.",
    author: "Iris Apfel",
  },
  {
    text: "Style is something each of us already has; all we need to do is find it.",
    author: "Diane von Furstenberg",
  },
  {
    text: "Fashion is instant language.",
    author: "Miuccia Prada",
  },
  {
    text: "The best color in the whole world is the one that looks good on you.",
    author: "Coco Chanel",
  },
  {
    text: "Over the years I have learned that what is important in a dress is the woman who is wearing it.",
    author: "Yves Saint Laurent",
  },
  {
    text: "Fashion is part of the daily air and it changes all the time.",
    author: "Diana Vreeland",
  },
  {
    text: "Style is a reflection of your attitude and your personality.",
    author: "Shawn Ashmore",
  },
  {
    text: "Confidence. If you have it, you can make anything look good.",
    author: "Diane von Furstenberg",
  },
  {
    text: "Fashion is art and you are the canvas.",
    author: "Velvet Paper",
  },
  {
    text: "Your style should tell your story before you say a word.",
    author: "Unknown",
  },
  {
    text: "Wear what makes you feel powerful.",
    author: "Unknown",
  },
  {
    text: "Great style begins with self-confidence.",
    author: "Unknown",
  },
  {
    text: "Dress like you're already where you want to be.",
    author: "Unknown",
  },
];
