/**
 * Single source of truth for quiz categories.
 *
 * Adding a new category (e.g., TypeScript, HTML) is one edit here plus
 * a `content/questions/<id>/` directory — every consumer (zod enum, id
 * prefix validation, round picker, diagnosis personas, labels, OG image)
 * derives from this list, so no other module needs to know the count.
 *
 * The tuple is `as const` so `(typeof CATEGORIES)[number]` keeps literal
 * types for `id`, `persona.code`, etc.
 */
export const CATEGORIES = [
  {
    id: "javascript",
    idPrefix: "js",
    display: "JavaScript",
    short: "JS",
    persona: {
      code: "JS",
      name: "JS 사냥꾼",
      emoji: "🦊",
      blurb: "비동기·클로저·이벤트 루프, 싹 다 잡았네.",
    },
  },
  {
    id: "react",
    idPrefix: "react",
    display: "React",
    short: "React",
    persona: {
      code: "React",
      name: "리액트 장인",
      emoji: "⚛️",
      blurb: "훅 한 번에 잡고 렌더 흐름까지 꿰뚫었네.",
    },
  },
  {
    id: "css",
    idPrefix: "css",
    display: "CSS",
    short: "CSS",
    persona: {
      code: "CSS",
      name: "픽셀 조각가",
      emoji: "🎨",
      blurb: "픽셀 1px도 그냥 안 넘어가, 디테일 장인이네.",
    },
  },
  {
    id: "typescript",
    idPrefix: "ts",
    display: "TypeScript",
    short: "TS",
    persona: {
      code: "TS",
      name: "타입 추론가",
      emoji: "🔷",
      blurb: "any 안 쓰고 제네릭으로 끝까지 좁혔네.",
    },
  },
  {
    id: "html",
    idPrefix: "html",
    display: "HTML",
    short: "HTML",
    persona: {
      code: "HTML",
      name: "시맨틱 빌더",
      emoji: "🧱",
      blurb: "div 떡칠 안 하고 시맨틱 태그 딱 골라 쓰네.",
    },
  },
  {
    id: "browser",
    idPrefix: "browser",
    display: "Browser",
    short: "Browser",
    persona: {
      code: "Browser",
      name: "브라우저 탐험가",
      emoji: "🌐",
      blurb: "렌더링 파이프라인부터 캐시까지, 브라우저 속살을 잘 아네.",
    },
  },
  {
    id: "performance",
    idPrefix: "perf",
    display: "Performance",
    short: "Perf",
    persona: {
      code: "Perf",
      name: "성능 튜너",
      emoji: "⚡",
      blurb: "프레임 드랍과 Core Web Vitals를 그냥 지나치지 않네.",
    },
  },
  {
    id: "nextjs",
    idPrefix: "next",
    display: "Next.js",
    short: "Next",
    persona: {
      code: "Next",
      name: "넥스트 항해사",
      emoji: "▲",
      blurb: "라우터·캐시·렌더링 전략을 상황에 맞게 잘 고르네.",
    },
  },
] as const;

export type Category = (typeof CATEGORIES)[number]["id"];
export type CategoryEntry = (typeof CATEGORIES)[number];
export type Persona = CategoryEntry["persona"];

/** Tuple of ids for `z.enum(...)`. Preserves literal union via the `as` cast. */
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [
  Category,
  ...Category[],
];

const BY_ID: Record<Category, CategoryEntry> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<Category, CategoryEntry>;

const BY_PERSONA_CODE: ReadonlyMap<string, CategoryEntry> = new Map(
  CATEGORIES.map((c) => [c.persona.code.toLowerCase(), c]),
);

const BY_PERSONA_NAME: ReadonlyMap<string, CategoryEntry> = new Map(
  CATEGORIES.map((c) => [c.persona.name, c]),
);

export function getCategory(id: Category): CategoryEntry {
  return BY_ID[id];
}

export function getPersona(id: Category): Persona {
  return BY_ID[id].persona;
}

export function getIdPrefix(id: Category): string {
  return BY_ID[id].idPrefix;
}

export function displayLabel(id: Category): string {
  return BY_ID[id].display;
}

export function shortLabel(id: Category): string {
  return BY_ID[id].short;
}

/**
 * Look up a persona by stored result_type string. Used by share pages to
 * resolve a row's hero without re-grading.
 */
export function findPersonaByName(name: string): CategoryEntry | null {
  return BY_PERSONA_NAME.get(name) ?? null;
}

/** Look up by short code (e.g., "JS"). Case-insensitive. */
export function findPersonaByCode(code: string): CategoryEntry | null {
  return BY_PERSONA_CODE.get(code.toLowerCase()) ?? null;
}
