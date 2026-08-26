"use client";

import posthog from "posthog-js";
import type { Level } from "@/lib/levels";
import type { Category, Difficulty, QuestionType } from "@/lib/question.schema";
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
  question_type: QuestionType;
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
 * 키 유무는 빌드 타임에 inlining 되므로 모듈 로드 시 한 번만 본다. 키 없는
 * dev/CI에서는 즉시 no-op.
 */
const HAS_KEY = !!import.meta.env.VITE_POSTHOG_KEY;

/**
 * 타입 안전한 PostHog 이벤트 캡처.
 *
 * init은 entry.client가 하이드레이션 전에 끝내므로(`initPostHog`) 어떤 effect
 * 시점에도 바로 capture해도 안전하다 — 과거의 `posthog.__loaded` 게이트 + 큐는
 * 제거했다. `__loaded`는 posthog-js 최신 버전에서 더 이상 설정되지 않는 죽은
 * 플래그라(타입에만 남아 있음) 게이트로 쓰면 모든 이벤트가 조용히 버려진다.
 */
export function track<K extends keyof AnalyticsEvents>(
  event: K,
  props: AnalyticsEvents[K],
): void {
  if (typeof window === "undefined") {
    return;
  }
  if (!HAS_KEY) {
    return;
  }
  posthog.capture(event, props as Record<string, unknown>);
}
