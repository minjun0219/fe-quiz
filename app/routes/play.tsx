import { Suspense } from "react";
import { Await } from "react-router";
import { toLevel } from "@/lib/levels";
import { logger } from "@/lib/logger.server";
import type { PublicQuestion } from "@/lib/question.schema";
import {
  pickRoundQuestions,
  pickRoundQuestionsByIds,
  ROUND_SIZE,
} from "@/lib/round.server";
import { getShareById } from "@/lib/share-store.server";
import RoundRunner from "../play/round-runner";
import type { Route } from "./+types/play";

/** Hard cap on replay length. Defends against a row whose `question_ids`
 *  somehow exceeds the round-size budget (이전 데이터 등 비정상 row 방어). */
const REPLAY_CAP = ROUND_SIZE;

/**
 * `?from=<slug>` replays the exact same questions in the same order — the
 * mechanic that makes shared rounds comparable. If the slug is invalid or
 * the share has been deleted, fall back to a random round rather than
 * 404'ing — friend should still get to play. `level` is ignored on replay
 * since the question set is fixed by the share row.
 *
 * `questions`는 promise를 await 없이 그대로 반환한다(streaming) — 클릭 즉시
 * Suspense fallback 셸이 뜨고, 픽이 끝나면 라운드가 스트리밍된다. 구 Next
 * loading.tsx의 "한 박자 늦음" 방지 UX를 그대로 재현.
 */
export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? undefined;
  const level = toLevel(url.searchParams.get("level"));
  return {
    level,
    replay: Boolean(from),
    questions: resolveQuestions(from, level),
  };
}

async function resolveQuestions(
  from: string | undefined,
  level: ReturnType<typeof toLevel>,
): Promise<PublicQuestion[]> {
  if (!from) {
    return pickRoundQuestions(ROUND_SIZE, level);
  }
  // D1 장애도 랜덤 라운드로 폴백한다(가용성 우선 — 친구는 어쨌든 풀 수
  // 있어야 함). 대신 조용히 삼키지 않고 로깅해 관측은 남긴다.
  const share = await getShareById(from).catch((err) => {
    logger.error({ err, from }, "[play] getShareById failed — random fallback");
    return null;
  });
  if (!share) {
    return pickRoundQuestions(ROUND_SIZE, level);
  }
  const replayed = await pickRoundQuestionsByIds(
    share.question_ids.slice(0, REPLAY_CAP),
  );
  return replayed.length > 0 ? replayed : pickRoundQuestions(ROUND_SIZE, level);
}

/** 픽 대기 중 즉시 뜨는 셸 — 구 app/play/loading.tsx의 카피/골격 유지. */
function PickingShell() {
  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center px-6 text-center"
      aria-busy="true"
      aria-live="polite"
    >
      <p className="mb-3 animate-pulse text-sm font-medium text-rose-500">
        누룽지가 문제 고르는 중…
      </p>
      <h1 className="text-2xl font-bold">잠깐만, 문제 가져올게</h1>
    </main>
  );
}

export default function Play({ loaderData }: Route.ComponentProps) {
  const { level, replay, questions } = loaderData;
  return (
    <Suspense fallback={<PickingShell />}>
      <Await resolve={questions}>
        {(resolved) => (
          // `key` ties RoundRunner's identity to the round so any future
          // "다시 풀기" path (or a remount on navigation) gives us clean state.
          <RoundRunner
            key={resolved.map((q) => q.id).join(",")}
            questions={resolved}
            level={level}
            replay={replay}
          />
        )}
      </Await>
    </Suspense>
  );
}
