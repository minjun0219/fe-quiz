import "server-only";
import { nanoid } from "nanoid";
import { cache } from "react";
import type { GradedRound } from "./grading";
import type { ShareRow } from "./share.schema";
import { getSupabase } from "./supabase";

const SLUG_LENGTH = 8;

interface CreateShareInput {
  graded: GradedRound;
  result_type: string;
  feedback: string;
}

/**
 * Insert a new shares row. Returns the slug. Score is stored as a percentage
 * (0..100) to match the DB CHECK constraint; total_correct is recoverable on
 * read via `round(score * question_ids.length / 100)`.
 */
export async function createShare({
  graded,
  result_type,
  feedback,
}: CreateShareInput): Promise<string> {
  const slug = nanoid(SLUG_LENGTH);
  const score = graded.total === 0 ? 0 : Math.round((graded.total_correct / graded.total) * 100);

  const { error } = await getSupabase()
    .from("shares")
    .insert({
      id: slug,
      question_ids: graded.per_question.map((q) => q.id),
      score,
      feedback,
      result_type,
      category_scores: graded.category_scores,
    });

  if (error) {
    throw new Error(`Failed to create share: ${error.message}`);
  }
  return slug;
}

/**
 * Fetch a shares row by slug. Returns null if not found.
 *
 * Wrapped in React's `cache()` so per-request memoization holds across the
 * `generateMetadata` + page-component pair (both call this with the same
 * slug; without cache it would round-trip Supabase twice).
 */
export const getShareById = cache(async (id: string): Promise<ShareRow | null> => {
  const { data, error } = await getSupabase().from("shares").select("*").eq("id", id).maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch share: ${error.message}`);
  }
  if (!data) return null;
  return data as ShareRow;
});
