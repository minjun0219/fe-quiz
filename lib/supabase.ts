import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let cached: SupabaseClient<Database> | null = null;

/**
 * Server-side Supabase client.
 *
 * Uses a **secret key** (legacy `service_role` JWT or new `sb_secret_...` —
 * both bypass RLS). The shares table's anon RLS policies are deliberately
 * empty (see migration `20260509000002_lock_down_shares_rls.sql`), so direct
 * REST calls with a publishable key cannot INSERT or SELECT. Our route
 * handlers are the only legal entry point.
 *
 * 환경별 분리:
 *   - production (`VERCEL_ENV === "production"`) → `SUPABASE_URL` /
 *     `SUPABASE_SECRET_KEY` (운영 전용 Supabase 프로젝트)
 *   - 그 외 (Vercel preview, 로컬, CI) → `SUPABASE_DEV_URL` /
 *     `SUPABASE_DEV_SECRET_KEY` (공유 개발 프로젝트)
 *
 * `VERCEL_ENV`로 분기하는 이유: `next start`가 로컬에서도 `NODE_ENV=production`
 * 을 세팅하므로, `NODE_ENV` 기준이면 운영 빌드를 로컬에서 돌릴 때 prod DB로
 * 새는 사고 경로가 생긴다. `VERCEL_ENV`는 Vercel 런타임에서만 박히는 값이라
 * 안전.
 *
 * ⚠️ NEVER expose `SUPABASE_SECRET_KEY` to the browser. No `NEXT_PUBLIC_`
 * prefix. No client component import. This module's consumers
 * (`lib/share-store.ts` etc.) cross `import "server-only"` boundaries which
 * surfaces accidental client imports as a build-time error.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (cached) {
    return cached;
  }

  const isProd = process.env.VERCEL_ENV === "production";
  const url = isProd ? process.env.SUPABASE_URL : process.env.SUPABASE_DEV_URL;
  const key = isProd
    ? process.env.SUPABASE_SECRET_KEY
    : process.env.SUPABASE_DEV_SECRET_KEY;
  if (!url || !key) {
    const vars = isProd
      ? "SUPABASE_URL and SUPABASE_SECRET_KEY"
      : "SUPABASE_DEV_URL and SUPABASE_DEV_SECRET_KEY";
    throw new Error(
      `Supabase env vars missing. Set ${vars} (server-only — never NEXT_PUBLIC_).`,
    );
  }

  cached = createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return cached;
}
