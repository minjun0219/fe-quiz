import { Link } from "react-router";
import { ContributeNote } from "@/components/credits";
import { CATEGORY_DISPLAY_LABEL } from "@/lib/category-labels";
import {
  buildTypeCode,
  computePersonality,
  resolveResultHero,
  STRONG_THRESHOLD,
  WEAK_THRESHOLD,
} from "@/lib/diagnosis";
import { renderFeedbackInline } from "@/lib/feedback-render";
import { ANONYMOUS_LABEL } from "@/lib/nickname";
import type { Category } from "@/lib/question.schema";
import { getRoundStanding, getShareById } from "@/lib/share-store.server";
import { resolveSiteUrl } from "@/lib/site-url.server";
import { describeStanding } from "@/lib/standing";
import type { Route } from "./+types/share";

/**
 * D1/설정 에러는 그대로 throw — 루트 ErrorBoundary가 500 화면을 그린다.
 * 장애를 "share not found"로 뭉개면 오진이라, notFound(404)는 row가 정말
 * 없는 경우(`null`)에만 던진다.
 */
export async function loader({ params, request }: Route.LoaderArgs) {
  const share = await getShareById(params.slug);
  if (!share) {
    throw new Response("Not Found", { status: 404 });
  }
  // meta()는 클라이언트 내비게이션에서도 실행되므로 env 접근은 loader에서
  // 끝내고 절대 URL을 데이터로 내려보낸다.
  const siteUrl = resolveSiteUrl(request);
  return {
    share,
    // 점수판은 실패해도 null — 결과 페이지 자체는 떠야 한다.
    standing: await getRoundStanding(share),
    ogImageUrl: new URL(`/r/${params.slug}/og.png`, siteUrl).toString(),
  };
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  if (!loaderData) {
    return [{ title: "결과를 못 찾았어 — FE 퀴즈" }];
  }
  const { share, standing, ogImageUrl } = loaderData;
  const hero = resolveResultHero(share.result_type);
  const total = share.question_ids.length;
  const title = `${hero.emoji} ${hero.name} (${share.score}점) — FE 퀴즈`;
  // 점수판이 있으면 순위를 카드에 실어 보낸다 — 링크를 받는 쪽에 "같은 문제로
  // 겨뤄보자"가 바로 읽히는 게 이 기능의 요점이다. 혼자면 비교 대상이 없어
  // 기존 문구 그대로.
  const standingLine =
    standing && !standing.alone ? `${describeStanding(standing)} — ` : "";
  const description = `${hero.blurb} ${standingLine}너도 같은 ${total}문제 풀어봐.`;
  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "article" },
    { property: "og:locale", content: "ko_KR" },
    { property: "og:image", content: ogImageUrl },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: ogImageUrl },
  ];
};

export default function SharePage({
  loaderData,
  params,
}: Route.ComponentProps) {
  const { share, standing } = loaderData;

  const hero = resolveResultHero(share.result_type);
  const total = share.question_ids.length;
  const totalCorrect = Math.round((share.score * total) / 100);
  // Show the type-code chip only for new persona-backed shares; legacy rows
  // (whose `result_type` matches a v1 vibe label) don't carry enough info to
  // pick a meaningful dominant category.
  const personality = hero.persona
    ? computePersonality(share.category_scores)
    : null;
  const typeCode = hero.persona
    ? buildTypeCode(personality ?? "balanced", hero.persona.id)
    : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-10">
      <section className="mb-8 text-center">
        <p className="mb-2 text-sm font-medium tracking-wide text-rose-500">
          🍘 누룽지의 진단
        </p>
        <h1 className="mb-2 text-4xl leading-tight font-bold tracking-tight">
          <span className="mr-2">{hero.emoji}</span>
          {hero.name}
        </h1>
        {typeCode && (
          <p className="mb-3">
            <span className="inline-block rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-semibold tracking-wider text-zinc-700 tabular-nums dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              {typeCode}
            </span>
            <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
              {personality === "balanced" ? "균형형" : "편식형"}
            </span>
          </p>
        )}
        <p className="mb-6 text-base text-zinc-600 dark:text-zinc-300">
          {hero.blurb}
        </p>
        <p className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
          {totalCorrect}{" "}
          <span className="text-zinc-400 dark:text-zinc-600">/</span> {total}
          <span className="ml-2 text-base font-medium text-zinc-500 dark:text-zinc-400">
            ({share.score}%)
          </span>
        </p>
      </section>

      {standing && (
        <section className="mb-8 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            같은 문제를 푼 사람들
          </h2>
          {standing.alone ? (
            <>
              {/* 첫 공유 수신자가 가장 먼저 보는 화면이다. 여기서 이름을
                  숨기면 "누가 보낸 결과인지 알아보기"라는 이 기능의 목적이
                  가장 흔한 흐름에서 그대로 실패한다. */}
              <p className="mb-3 text-base text-zinc-700 dark:text-zinc-200">
                아직 이 라운드 첫 주자예요. 링크를 넘겨서 누가 더 잘하나 봐요.
              </p>
              <ol className="flex flex-col gap-1">
                {standing.entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center gap-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-zinc-900 dark:bg-rose-500/10 dark:text-zinc-50"
                  >
                    <span className="w-6 shrink-0 text-right tabular-nums text-zinc-400 dark:text-zinc-500">
                      {entry.rank}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {entry.nickname ?? ANONYMOUS_LABEL}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {entry.score}점
                    </span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <>
              <p className="mb-3 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                {standing.players}명 중{" "}
                <span className="text-rose-500">{standing.rank}등</span>
                <span className="ml-2 text-base font-medium text-zinc-500 dark:text-zinc-400">
                  상위 {standing.top_percent}%
                </span>
              </p>
              <dl className="mb-5 flex gap-6 text-sm">
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">평균</dt>
                  <dd className="font-semibold tabular-nums text-zinc-800 dark:text-zinc-100">
                    {standing.average}점
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">최고</dt>
                  <dd className="font-semibold tabular-nums text-zinc-800 dark:text-zinc-100">
                    {standing.best}점
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">내 점수</dt>
                  <dd className="font-semibold tabular-nums text-zinc-800 dark:text-zinc-100">
                    {share.score}점
                  </dd>
                </div>
              </dl>

              <ol className="flex flex-col gap-1">
                {standing.entries.map((entry) => (
                  <li
                    key={entry.id}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                      entry.is_me
                        ? "bg-rose-50 font-semibold text-zinc-900 dark:bg-rose-500/10 dark:text-zinc-50"
                        : "text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <span className="w-6 shrink-0 text-right tabular-nums text-zinc-400 dark:text-zinc-500">
                      {entry.rank}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {entry.nickname ?? ANONYMOUS_LABEL}
                      {/* `is_me`는 "이 페이지를 보는 사람"이 아니라 "URL이
                          가리키는 공유 행"이다. 링크를 받은 친구에게 "나"라고
                          쓰면 남의 기록을 자기 것으로 읽게 된다. */}
                      {entry.is_me && (
                        <span className="ml-2 text-xs font-medium text-rose-500">
                          이 결과
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {entry.score}점
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      )}

      <section className="mb-8 rounded-2xl border border-rose-100 bg-rose-50/40 p-5 dark:border-rose-900/30 dark:bg-rose-500/5">
        <div className="mb-2 text-xs font-semibold tracking-wider text-rose-500 uppercase">
          🍘 누룽지의 한마디
        </div>
        <p className="whitespace-pre-line text-base leading-relaxed text-zinc-800 dark:text-zinc-100">
          {renderFeedbackInline(share.feedback)}
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          카테고리별
        </h2>
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
                <span className="w-24 shrink-0 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  {CATEGORY_DISPLAY_LABEL[cat]}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div
                    className={`h-full transition-all ${isStrong ? "bg-emerald-500" : isWeak ? "bg-rose-500" : "bg-amber-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
                  {score.correct}/{score.total}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-auto flex flex-col gap-3">
        <Link
          to={`/play?from=${params.slug}`}
          className="inline-flex h-14 w-full items-center justify-center rounded-full bg-zinc-900 px-8 text-base font-semibold text-white transition hover:bg-zinc-800 active:scale-[0.99] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          나도 같은 문제 풀어보기 →
        </Link>
        <Link
          to="/"
          className="inline-flex h-12 w-full items-center justify-center rounded-full text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          다른 라운드 풀어보기
        </Link>
        <ContributeNote />
      </div>
    </main>
  );
}
