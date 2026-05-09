import { CATEGORIES } from "./categories";
import type { Category } from "./question.schema";

/**
 * Long-form display labels — for UI surfaces (result page category bars,
 * round runner header, etc.). Reads as a brand name to the user.
 *
 * Derived from `lib/categories.ts`. This indirection exists so existing
 * imports keep working; new code should prefer `displayLabel(cat)` from
 * the registry.
 */
export const CATEGORY_DISPLAY_LABEL: Record<Category, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.display]),
) as Record<Category, string>;

/**
 * Short-form labels — for compact contexts where every token counts (LLM
 * prompts, OG image badges). Same shape, intentionally different values.
 */
export const CATEGORY_SHORT_LABEL: Record<Category, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.short]),
) as Record<Category, string>;
