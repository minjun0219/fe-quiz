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
 * dev/CI에서는 큐잉도 하지 않고 즉시 no-op.
 */
const HAS_KEY = !!import.meta.env.VITE_POSTHOG_KEY;

type QueuedEvent = {
  event: keyof AnalyticsEvents;
  props: Record<string, unknown>;
};

// React effect는 child→parent 순으로 실행되므로 `/play` cold load 시
// `RoundRunner`의 mount effect가 `PostHogProvider`의 init effect보다 먼저
// 돈다 → `posthog.__loaded`가 false라 round_started/첫 question_viewed가
// 영구 드롭. init 직후를 따라잡기 위해 짧게 큐잉 후 flush.
const queue: QueuedEvent[] = [];
const MAX_QUEUE = 50;
// 50ms × 20 = ~1s. 그 안에 init이 안 끝나면 키 잘못 설정/네트워크 문제로
// 보고 큐를 버린다 (메모리 무한 증가 방지).
const DRAIN_INTERVAL_MS = 50;
const MAX_DRAIN_ATTEMPTS = 20;
let drainScheduled = false;
let drainAttempts = 0;

function scheduleDrain(): void {
  if (drainScheduled) {
    return;
  }
  drainScheduled = true;
  setTimeout(drain, DRAIN_INTERVAL_MS);
}

function drain(): void {
  drainScheduled = false;
  if (posthog.__loaded) {
    for (const item of queue) {
      posthog.capture(item.event, item.props);
    }
    queue.length = 0;
    drainAttempts = 0;
    return;
  }
  drainAttempts += 1;
  if (drainAttempts >= MAX_DRAIN_ATTEMPTS) {
    queue.length = 0;
    drainAttempts = 0;
    return;
  }
  scheduleDrain();
}

/**
 * 타입 안전한 PostHog 이벤트 캡처.
 *
 * - 키 미설정 환경: 즉시 no-op (큐잉도 안 함).
 * - 키 설정 + init 완료: 즉시 capture.
 * - 키 설정 + init 진행 중(cold mount 직후): 큐에 쌓고 init 후 flush.
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
  if (posthog.__loaded) {
    posthog.capture(event, props as Record<string, unknown>);
    return;
  }
  if (queue.length >= MAX_QUEUE) {
    return;
  }
  queue.push({ event, props: props as Record<string, unknown> });
  scheduleDrain();
}
