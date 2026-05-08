import { pickRoundQuestions, pickRoundQuestionsByIds } from "@/lib/round";
import { getShareById } from "@/lib/share-store";
import RoundRunner from "./round-runner";

// Each visit picks a fresh round; never cache.
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ from?: string }>;
}

export default async function PlayPage({ searchParams }: Props) {
  const { from } = await searchParams;

  // `?from=<slug>` replays the exact same questions in the same order — the
  // mechanic that makes shared rounds comparable. If the slug is invalid or
  // the share has been deleted, fall back to a random round rather than
  // 404'ing — friend should still get to play.
  const questions = await resolveQuestions(from);

  // `key` ties RoundRunner's identity to the round so any future "다시 풀기"
  // path (or a remount on navigation) gives us clean state.
  const roundKey = questions.map((q) => q.id).join(",");
  return <RoundRunner key={roundKey} questions={questions} />;
}

async function resolveQuestions(from: string | undefined) {
  if (!from) return pickRoundQuestions();
  const share = await getShareById(from).catch(() => null);
  if (!share) return pickRoundQuestions();
  const replayed = pickRoundQuestionsByIds(share.question_ids);
  return replayed.length > 0 ? replayed : pickRoundQuestions();
}
