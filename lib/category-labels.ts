import type { Category } from "./question.schema";

/**
 * Long-form display labels — for UI surfaces (result page category bars,
 * round runner header, etc.). Reads as a brand name to the user.
 */
export const CATEGORY_DISPLAY_LABEL: Record<Category, string> = {
  javascript: "JavaScript",
  react: "React",
  css: "CSS",
};

/**
 * Short-form labels — for compact contexts where every token counts (LLM
 * prompts, OG image badges). Same shape, intentionally different values.
 */
export const CATEGORY_SHORT_LABEL: Record<Category, string> = {
  javascript: "JS",
  react: "React",
  css: "CSS",
};
