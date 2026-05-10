import { toLevel } from "@/lib/levels";
import {
  pickRoundQuestions,
  pickRoundQuestionsByIds,
  ROUND_SIZE,
} from "@/lib/round";
import { getShareById } from "@/lib/share-store";
import RoundRunner from "./round-runner";

/** Hard cap on replay length. Defends against a row whose `question_ids`
 *  somehow exceeds the round-size budget (RLS allows anon INSERT). */
const REPLAY_CAP = ROUND_SIZE;

// Each visit picks a fresh round; never cache.
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ from?: string; level?: string }>;
}

export default async function PlayPage({ searchParams }: Props) {
  const { from, level } = await searchParams;

  // `?from=<slug>` replays the exact same questions in the same order — the
  // mechanic that makes shared rounds comparable. If the slug is invalid or
  // the share has been deleted, fall back to a random round rather than
  // 404'ing — friend should still get to play. `level` is ignored on replay
  // since the question set is fixed by the share row.
  const questions = await resolveQuestions(from, toLevel(level));

  // `key` ties RoundRunner's identity to the round so any future "다시 풀기"
  // path (or a remount on navigation) gives us clean state.
  const roundKey = questions.map((q) => q.id).join(",");
  return <RoundRunner key={roundKey} questions={questions} />;
}

async function resolveQuestions(
  from: string | undefined,
  level: ReturnType<typeof toLevel>,
) {
  if (!from) {
    return pickRoundQuestions(ROUND_SIZE, level);
  }
  const share = await getShareById(from).catch(() => null);
  if (!share) {
    return pickRoundQuestions(ROUND_SIZE, level);
  }
  const replayed = await pickRoundQuestionsByIds(
    share.question_ids.slice(0, REPLAY_CAP),
  );
  return replayed.length > 0 ? replayed : pickRoundQuestions(ROUND_SIZE, level);
}
