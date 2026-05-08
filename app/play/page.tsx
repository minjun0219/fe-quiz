import { pickRoundQuestions } from "@/lib/round";
import RoundRunner from "./round-runner";

// Each visit picks a fresh random round; never cache.
export const dynamic = "force-dynamic";

export default function PlayPage() {
  const questions = pickRoundQuestions();
  return <RoundRunner questions={questions} />;
}
