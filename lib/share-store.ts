import "server-only";
import { nanoid } from "nanoid";
import { cache } from "react";
import type { GradedRound } from "./grading";
import { logger } from "./logger";
import { type ShareRow, ShareRowSchema } from "./share.schema";
import { getSupabase } from "./supabase";

const SLUG_LENGTH = 8;
const MAX_SLUG_RETRIES = 3;
/** Postgres unique-violation error code (also surfaces via PostgREST). */
const PG_UNIQUE_VIOLATION = "23505";

interface CreateShareInput {
  graded: GradedRound;
  result_type: string;
  feedback: string;
}

/**
 * Insert a new shares row. Returns the slug. Score is stored as a percentage
 * (0..100) to match the DB CHECK constraint; total_correct is recoverable on
 * read via `round(score * question_ids.length / 100)`.
 *
 * On slug collision (`23505` unique violation) we regenerate and retry up to
 * MAX_SLUG_RETRIES times. With 8-char nanoid the collision rate is
 * negligible, but a hard failure on a busy day shouldn't block a share.
 */
export async function createShare({
  graded,
  result_type,
  feedback,
}: CreateShareInput): Promise<string> {
  // Clamp to the DB CHECK constraint range so any rounding edge case (or a
  // future caller passing a score > total) can't trip the constraint.
  const rawScore =
    graded.total === 0
      ? 0
      : Math.round((graded.total_correct / graded.total) * 100);
  const score = Math.min(100, Math.max(0, rawScore));

  const insertRow = {
    question_ids: graded.per_question.map((q) => q.id),
    score,
    feedback,
    result_type,
    category_scores: graded.category_scores,
  };

  let lastError: string | null = null;
  for (let attempt = 0; attempt < MAX_SLUG_RETRIES; attempt++) {
    const slug = nanoid(SLUG_LENGTH);
    const { error } = await getSupabase()
      .from("shares")
      .insert({ id: slug, ...insertRow });

    if (!error) {
      return slug;
    }
    if (error.code !== PG_UNIQUE_VIOLATION) {
      throw new Error(`Failed to create share: ${error.message}`);
    }
    lastError = error.message;
  }
  throw new Error(
    `Failed to create share after ${MAX_SLUG_RETRIES} slug retries: ${lastError}`,
  );
}

/**
 * Fetch a shares row by slug. Returns null if not found OR if the row's
 * shape doesn't match `ShareRowSchema` — anonymous INSERT is allowed by RLS,
 * so a malformed `category_scores` jsonb could cause NaN widths or undefined
 * labels downstream. We treat schema-invalid rows as missing.
 *
 * Wrapped in React's `cache()` so per-request memoization holds across the
 * `generateMetadata` + page-component pair (both call this with the same
 * slug; without cache it would round-trip Supabase twice).
 */
export const getShareById = cache(
  async (id: string): Promise<ShareRow | null> => {
    const { data, error } = await getSupabase()
      .from("shares")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch share: ${error.message}`);
    }
    if (!data) {
      return null;
    }

    const parsed = ShareRowSchema.safeParse(data);
    if (!parsed.success) {
      logger.error(
        { id, issues: parsed.error.issues },
        "[share-store] row failed schema validation",
      );
      return null;
    }
    return parsed.data;
  },
);
