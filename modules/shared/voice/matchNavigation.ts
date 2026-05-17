import navConfig from "@/public/chatwonder/navigation.json";

export function matchNavigation(transcript: string): string | null {
  const t = transcript.toLowerCase().trim();
  for (const route of navConfig.routes) {
    for (const trigger of route.triggers) {
      if (t.includes(trigger.toLowerCase())) {
        return route.route;
      }
    }
  }
  return null;
}
