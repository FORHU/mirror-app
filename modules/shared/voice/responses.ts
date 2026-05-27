import { Route } from "./types";

export const ROUTE_RESPONSES: Record<
  Route,
  { open: string; intercept?: string }
> = {
  "/": {
    open: "Going to the landing page.",
    intercept: "Are you sure you want to restart?",
  },
  "/select-gender": {
    open: "Let's get started. First, I just need to know your gender.",
  },
  "/authentication": {
    open: "Going to the menu.",
    intercept: "Are you sure you want to go back to the menu?",
  },
  "/ai-recommendation-fashion": {
    open: "I can help with that. Let's look at your outfit options.",
    intercept: "Are you sure you want to go to the outfit styling?",
  },
  "/ai-recommendation-cosmetic": {
    open: "Sure thing, let's explore your makeup options.",
    intercept: "Are you sure you want to go to the cosmetics and skincare?",
  },
  "/map": {
    open: "Sure, let's pull up the map.",
    intercept: "Are you sure you want to go to the map?",
  },
  "/overview": {
    open: "Taking you back to the home screen.",
  },
  "/virtual-mirror": {
    open: "Opening the virtual mirror.",
  },
};

export const SYSTEM_RESPONSES = {
  genderGuard: "You need to select your gender first.",
  cancelled: "Okay, cancelled.",
  genderSetMale: "Got it, setting your profile to male.",
  genderSetFemale: "Got it, setting your profile to female.",
  defaultOpen: "Opening that up.",
};
