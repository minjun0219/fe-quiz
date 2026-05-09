import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContributeNote } from "@/components/credits";
import { CATEGORY_DISPLAY_LABEL } from "@/lib/category-labels";
import {
  buildTypeCode,
  computePersonality,
  resolveResultHero,
  STRONG_THRESHOLD,
  WEAK_THRESHOLD,
} from "@/lib/diagnosis";
import type { Category } from "@/lib/question.schema";
import { getShareById } from "@/lib/share-store";

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const share = await getShareById(slug).catch(() => null);
  if (!share) {
    return { title: "결과를 못 찾았어 — FE 퀴즈" };
  }
  const hero = resolveResultHero(share.result_type);
  const total = share.question_ids.length;
  const title = `${hero.emoji} ${hero.name} (${share.score}점) — FE 퀴즈`;
  const description = `${hero.blurb} 너도 같은 ${total}문제 풀어봐.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "article", locale: "ko_KR" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SharePage({ params }: Props) {
  const { slug } = await params;
  // Let Supabase / config errors throw — Next renders 500. Swallowing them
  // would mask outages as "share not found", which is misleading. notFound()
  // is reserved for the real "row doesn't exist" case (`null`).
  const share = await getShareById(slug);
  if (!share) notFound();

  const hero = resolveResultHero(share.result_type);
  const total = share.question_ids.length;
  const totalCorrect = Math.round((share.score * total) / 100);
  // Show the type-code chip only for new persona-backed shares; legacy rows
  // (whose `result_type` matches a v1 vibe label) don't carry enough info to
  // pick a meaningful dominant category.
  const personality = hero.persona ? computePersonality(share.category_scores) : null;
  const typeCode = hero.persona ? buildTypeCode(personality ?? "balanced", hero.persona.id) : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-10">
      <section className="mb-8 text-center">
        <p className="mb-2 text-sm font-medium tracking-wide text-rose-500">친구의 진단</p>
        <h1 className="mb-2 text-4xl leading-tight font-bold tracking-tight">
          <span className="mr-2">{hero.emoji}</span>
          {hero.name}
        </h1>
        {typeCode && (
          <p className="mb-3">
            <span className="inline-block rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-semibold tracking-wider text-zinc-700 tabular-nums">
              {typeCode}
            </span>
            <span className="ml-2 text-xs text-zinc-500">
              {personality === "balanced" ? "균형형" : "편식형"}
            </span>
          </p>
        )}
        <p className="mb-6 text-base text-zinc-600">{hero.blurb}</p>
        <p className="text-2xl font-semibold tabular-nums text-zinc-900">
          {totalCorrect} <span className="text-zinc-400">/</span> {total}
          <span className="ml-2 text-base font-medium text-zinc-500">({share.score}%)</span>
        </p>
      </section>

      <section className="mb-8 rounded-2xl border border-rose-100 bg-rose-50/40 p-5">
        <div className="mb-2 text-xs font-semibold tracking-wider text-rose-500 uppercase">
          친구의 한마디
        </div>
        <p className="whitespace-pre-line text-base leading-relaxed text-zinc-800">
          {share.feedback}
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold text-zinc-500">카테고리별</h2>
        <ul className="flex flex-col gap-3">
          {(
            Object.entries(share.category_scores) as [
              Category,
              { correct: number; total: number },
            ][]
          ).map(([cat, score]) => {
            const acc = score.total === 0 ? 0 : score.correct / score.total;
            const pct = Math.round(acc * 100);
            const isStrong = acc >= STRONG_THRESHOLD;
            const isWeak = acc < WEAK_THRESHOLD;
            return (
              <li key={cat} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm font-medium text-zinc-700">
                  {CATEGORY_DISPLAY_LABEL[cat]}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200">
                  <div
                    className={`h-full transition-all ${isStrong ? "bg-emerald-500" : isWeak ? "bg-rose-500" : "bg-amber-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-sm tabular-nums text-zinc-600">
                  {score.correct}/{score.total}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-auto flex flex-col gap-3">
        <Link
          href={`/play?from=${slug}`}
          className="inline-flex h-14 w-full items-center justify-center rounded-full bg-zinc-900 px-8 text-base font-semibold text-white transition hover:bg-zinc-800 active:scale-[0.99]"
        >
          나도 같은 문제 풀어보기 →
        </Link>
        <Link
          href="/play"
          className="inline-flex h-12 w-full items-center justify-center rounded-full text-sm font-medium text-zinc-500 hover:text-zinc-700"
        >
          다른 라운드 풀어보기
        </Link>
        <ContributeNote />
      </div>
    </main>
  );
}
