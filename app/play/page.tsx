import { pickRoundQuestions } from "@/lib/round";
import RoundRunner from "./round-runner";

// Each visit picks a fresh random round; never cache.
export const dynamic = "force-dynamic";

export default function PlayPage() {
  const questions = pickRoundQuestions();
  // `key` ties RoundRunner's identity to the round so any future "다시 풀기"
  // path (or a remount on navigation) gives us clean state.
  const roundKey = questions.map((q) => q.id).join(",");
  return <RoundRunner key={roundKey} questions={questions} />;
}
