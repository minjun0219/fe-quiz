import "server-only";
import { join } from "node:path";
import { loadAllQuestions } from "./load-questions";
import type { Question } from "./question.schema";

const ROOT = join(process.cwd(), "content/questions");

let cache: readonly Question[] | null = null;

/**
 * Public server-only API — return all validated questions.
 * Walks the filesystem once per process (cached + frozen so callers can't
 * mutate the shared array). Server components and route handlers only.
 */
export function getAllQuestions(): readonly Question[] {
  if (cache) return cache;
  cache = Object.freeze(loadAllQuestions(ROOT));
  return cache;
}

export function getQuestionsByCategory(category: Question["category"]): readonly Question[] {
  return getAllQuestions().filter((q) => q.category === category);
}

export function getQuestionById(id: string): Question | undefined {
  return getAllQuestions().find((q) => q.id === id);
}
