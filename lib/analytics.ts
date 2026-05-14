"use client";

import posthog from "posthog-js";
import type { Level } from "@/lib/levels";
import type { Category, Difficulty } from "@/lib/question.schema";
import type { Personality } from "@/lib/quiz-submit.schema";

type RoundStartedProps = {
  level: Level;
  question_count: number;
  question_ids: string[];
  categories: Category[];
  difficulties: Difficulty[];
  mix: Record<Difficulty, number>;
  replay: boolean;
};

type QuestionViewedProps = {
  level: Level;
  index: number;
  question_id: string;
  category: Category;
  difficulty: Difficulty;
  question_type: "single_choice" | "multi_choice";
};

type QuestionAnsweredProps = QuestionViewedProps & {
  dwell_ms: number;
  selection_count: number;
};

type RoundSubmittedProps = {
  level: Level;
  round_duration_ms: number;
  question_count: number;
};

type ResultViewedProps = {
  level: Level;
  total: number;
  total_correct: number;
  pct: number;
  type_code: string;
  personality: Personality;
  strengths: Category[];
  weaknesses: Category[];
};

type ResultDwellProps = {
  level: Level;
  dwell_ms: number;
  feedback_status: "loading" | "streaming" | "done" | "error" | "unavailable";
  shared: boolean;
};

type FeedbackCompletedProps = {
  level: Level;
  status: "done" | "error" | "unavailable";
  duration_ms: number;
  char_count: number;
};

type ShareCreatedProps = {
  level: Level;
  slug: string;
  duration_ms: number;
};

export type AnalyticsEvents = {
  level_selected: { level: Level };
  round_started: RoundStartedProps;
  question_viewed: QuestionViewedProps;
  question_answered: QuestionAnsweredProps;
  round_submitted: RoundSubmittedProps;
  round_submit_failed: { level: Level; message: string };
  result_viewed: ResultViewedProps;
  result_dwell: ResultDwellProps;
  result_questions_toggled: { open: boolean; level: Level };
  feedback_requested: { level: Level };
  feedback_completed: FeedbackCompletedProps;
  share_clicked: { level: Level; total_correct: number; pct: number };
  share_created: ShareCreatedProps;
  share_failed: { level: Level; message: string };
  share_copy_clicked: { level: Level; surface: "panel" | "auto" };
  share_native_clicked: { level: Level };
};

/**
 * 타입 안전한 PostHog 이벤트 캡처. 키가 미설정인 환경에서는 `posthog.__loaded`가
 * false라 no-op이 되므로 dev/CI에서도 throw 없이 안전하다.
 */
export function track<K extends keyof AnalyticsEvents>(
  event: K,
  props: AnalyticsEvents[K],
): void {
  if (typeof window === "undefined") {
    return;
  }
  if (!posthog.__loaded) {
    return;
  }
  posthog.capture(event, props as Record<string, unknown>);
}
