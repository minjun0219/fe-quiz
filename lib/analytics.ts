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
  /**
   * 뒤로가기로 되돌아온 재방문이면 true. 문항 진행 퍼널을 그릴 때는
   * `is_revisit = false`로 걸러야 index당 1회만 세어진다 — 안 거르면 왕복한
   * 사용자가 같은 index를 여러 번 찍어 이탈률이 실제보다 낮게 보인다.
   */
  is_revisit: boolean;
};

type QuestionAnsweredProps = Omit<QuestionViewedProps, "is_revisit"> & {
  dwell_ms: number;
  selection_count: number;
  /**
   * 이미 답한 문항으로 돌아와 다시 확정한 경우 true. 퍼널은
   * `is_revision = false`로 거른다. 거르지 않은 전체는 "몇 번 고쳐 답했나"
   * (=헷갈리는 문항 탐지) 신호로 쓸 수 있다.
   */
  is_revision: boolean;
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
 * 시점에도 바로 capture해도 안전하다 — init 완료를 기다리던 과거의
 * `__loaded` 게이트 + 큐는 불필요해져 제거했다.
 *
 * 참고: 자동화 브라우저(Playwright 등)에선 posthog-js의 봇 필터
 * (`navigator.webdriver`/UA 검사)가 capture를 조용히 드롭한다 — E2E에서
 * 이벤트가 안 보이는 건 버그가 아니라 의도된 동작.
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
