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

let mapCache: ReadonlyMap<string, Question> | null = null;

/**
 * Cached id → Question index. Built once per process the first time it's
 * asked for, so route handlers (e.g., /api/quiz/submit) don't pay an
 * O(n) Map construction per request.
 */
export function getQuestionMap(): ReadonlyMap<string, Question> {
  if (mapCache) return mapCache;
  mapCache = new Map(getAllQuestions().map((q) => [q.id, q]));
  return mapCache;
}

export function getQuestionById(id: string): Question | undefined {
  return getQuestionMap().get(id);
}
