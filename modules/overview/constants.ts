/**
 * sessionStorage key used to hand a spoken prompt from /ai-assistant to
 * /overview. The assistant stashes the user's command here right before it
 * navigates (when its backend routes to /overview); /overview reads it once on
 * mount, clears it, and re-fires it through ChatWonder to populate the grid.
 */
export const OVERVIEW_PROMPT_KEY = "overview_prompt";
