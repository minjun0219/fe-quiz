import { useCallback, useEffect, useId, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import type { HintResponse } from "@/lib/hint.schema";
import { MIN_NUDGE_AT_MS } from "@/lib/hint-policy";
import type { SubmittedAnswer } from "@/lib/quiz-submit.schema";

/**
 * 구석에 상주하는 캐릭터. 헤매는 것 같으면 뱃지와 작은 움직임으로만 알린다 —
 * "힌트 줄까?" 하고 묻지 않는다. 말로 물으면 사무적인 팝업이 되고, 거절이라는
 * 행동을 하나 더 만든다.
 *
 * **뱃지는 접근 권한이 아니라 알림이다.** 조용할 때 눌러도 힌트는 나온다.
 * 그러지 않으면 캐릭터가 대부분의 시간 동안 눌러도 아무 일 없는 장식이 된다.
 *
 * 서버 왕복은 문항당 한 번. 응답에 담긴 `nudge_at_ms`(이만큼 머무르면 알려라)를
 * 받아 카운트다운은 여기서 한다. 실패하면 조용히 아무 일도 없던 것처럼 둔다 —
 * 부가 기능이 본 흐름에 에러를 띄우면 안 된다.
 */

interface Props {
  questionIds: readonly string[];
  /** 지금까지의 답. 서버가 힌트 타이밍을 정할 때만 쓰고 응답에는 안 나온다. */
  answers: readonly SubmittedAnswer[];
  index: number;
  /** 앞서 봤던 문항으로 되돌아온 것인지. */
  isRevisit: boolean;
  /** 이 문항에서 선택을 바꾼 횟수. */
  changeCount: number;
}

interface Entry {
  hint: string | null;
  hintHtml?: string;
  nudgeAtMs: number | null;
}

type Status = "idle" | "loading" | "ready" | "failed";

export default function HintBuddy({
  questionIds,
  answers,
  index,
  isRevisit,
  changeCount,
}: Props) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);

  // effect 의존성에서 빼기 위한 최신값 통로. 답을 고를 때마다 바뀌는 값들이라
  // 의존성에 넣으면 선택 한 번에 타이머가 리셋된다.
  const latestRef = useRef({ questionIds, answers, changeCount, isRevisit });
  latestRef.current = { questionIds, answers, changeCount, isRevisit };

  const probe = useCallback(async (at: number): Promise<Entry | null> => {
    const {
      questionIds: ids,
      answers: ans,
      changeCount: cc,
    } = latestRef.current;
    try {
      const res = await fetch("/api/quiz/hint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question_ids: ids,
          answers: ans,
          index: at,
          change_count: cc,
          is_revisit: latestRef.current.isRevisit,
        }),
      });
      if (!res.ok) {
        return null;
      }
      const data = (await res.json()) as HintResponse;
      return {
        hint: data.hint,
        hintHtml: data.hint_html,
        nudgeAtMs: data.nudge_at_ms,
      };
    } catch {
      // 힌트는 부가 기능이다. 조용히 없던 일로 둔다.
      return null;
    }
  }, []);

  useEffect(() => {
    const viewedAt = Date.now();
    let cancelled = false;
    let badgeTimer: ReturnType<typeof setTimeout> | undefined;

    setOpen(false);
    setAvailable(false);

    function scheduleBadge(e: Entry) {
      // 지역 상수로 받아둔다 — 클로저 안에서는 `e.nudgeAtMs`의 narrowing이
      // 유지되지 않는다.
      const nudgeAtMs = e.nudgeAtMs;
      if (nudgeAtMs === null || e.hint === null) {
        return;
      }
      const wait = Math.max(0, viewedAt + nudgeAtMs - Date.now());
      badgeTimer = setTimeout(() => {
        if (cancelled) {
          return;
        }
        setAvailable(true);
        track("hint_nudged", { index, nudge_at_ms: nudgeAtMs });
      }, wait);
    }

    setEntry(null);
    setStatus("idle");
    // 방문마다 새로 묻는다. 임계값은 문항의 성질이 아니라 **지금 이 사람의
    // 상황**이라 캐시하면 안 된다 — 첫 방문에서 받은 35초를 재방문에 재사용하면
    // "되돌아왔다 = 확실히 막혔다"는 신호가 통째로 묻힌다.
    //
    // 서버가 돌려줄 수 있는 가장 이른 시점에 맞춰 묻는다. 이보다 일찍 물으면
    // 빨리 넘어가는 문항에서 요청만 버려진다.
    const probeTimer = setTimeout(
      () => {
        setStatus("loading");
        void probe(index).then((e) => {
          if (cancelled) {
            return;
          }
          setEntry(e);
          setStatus(e ? "ready" : "failed");
          if (e) {
            scheduleBadge(e);
          }
        });
      },
      isRevisit ? 0 : MIN_NUDGE_AT_MS,
    );

    return () => {
      cancelled = true;
      clearTimeout(probeTimer);
      clearTimeout(badgeTimer);
    };
  }, [index, isRevisit, probe]);

  // 패널은 고정 오버레이라 좁은 화면에서는 보기 하나를 덮는다. 바깥을 누르면
  // 닫히게 해서 "가려서 못 고르는" 상태가 한 번의 탭으로 풀리게 한다.
  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    function onPointerDown(e: PointerEvent) {
      const root = rootRef.current;
      if (root && e.target instanceof Node && !root.contains(e.target)) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setAvailable(false);
    track("hint_opened", { index, nudged: available });
    // 뱃지가 뜨기 전에 눌렀으면 아직 안 받아왔다. 그 자리에서 받아온다.
    if (!entry && status !== "loading") {
      setStatus("loading");
      const e = await probe(index);
      setEntry(e);
      setStatus(e ? "ready" : "failed");
    }
  }

  return (
    <div
      ref={rootRef}
      className="fixed right-4 bottom-28 z-40 flex flex-col items-end gap-2"
    >
      {open && (
        <div
          id={panelId}
          className="max-w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-zinc-200 bg-white p-4 text-sm leading-relaxed text-zinc-700 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
        >
          <p className="mb-2 text-xs font-medium tracking-wide text-rose-500">
            누룽지의 힌트
          </p>
          <HintBody status={status} entry={entry} />
        </div>
      )}

      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={available ? "힌트 있음 — 누룽지 열기" : "누룽지 힌트"}
        className={`relative flex h-14 w-14 items-center justify-center rounded-full border-2 bg-white text-2xl shadow-md transition active:scale-95 dark:bg-zinc-900 ${
          available
            ? "border-rose-400 motion-safe:animate-hint-nudge"
            : "border-zinc-200 dark:border-zinc-700"
        }`}
      >
        <span aria-hidden>🍘</span>
        {available && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-rose-500 dark:border-zinc-900"
          />
        )}
      </button>
    </div>
  );
}

function HintBody({ status, entry }: { status: Status; entry: Entry | null }) {
  if (status === "loading") {
    return <p className="animate-pulse text-zinc-400">잠깐만…</p>;
  }
  if (status === "failed") {
    return <p className="text-zinc-500">지금은 힌트를 못 가져왔어요.</p>;
  }
  if (!entry || entry.hint === null) {
    return (
      <p className="text-zinc-500">이 문제는 아직 힌트를 안 만들어 뒀어요.</p>
    );
  }
  if (entry.hintHtml) {
    return (
      // biome-ignore lint/security/noDangerouslySetInnerHtml: server-rendered by `renderQuizMarkdown` from our own YAML seed (no user input); only inline-code spans, <strong>, and HTML-escaped <pre><code> from fenced blocks are injected.
      <p dangerouslySetInnerHTML={{ __html: entry.hintHtml }} />
    );
  }
  return <p>{entry.hint}</p>;
}
