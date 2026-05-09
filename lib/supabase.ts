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
 * ⚠️ NEVER expose `SUPABASE_SECRET_KEY` to the browser. No `NEXT_PUBLIC_`
 * prefix. No client component import. This module's consumers
 * (`lib/share-store.ts` etc.) cross `import "server-only"` boundaries which
 * surfaces accidental client imports as a build-time error.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (cached) {
    return cached;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env vars missing. Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local (server-only — never NEXT_PUBLIC_).",
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
