import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let cached: SupabaseClient<Database> | null = null;

/**
 * Server-side Supabase client.
 *
 * Uses the publishable key — RLS policies on `shares` allow anon INSERT/SELECT,
 * which is fine because all writes go through validated route handlers.
 *
 * No `NEXT_PUBLIC_` prefix on the env vars: the client never reaches the
 * browser bundle (this module is server-only via consumers' `import "server-only"`
 * boundaries). Reintroduce the prefix only if a client component needs the
 * Supabase JS client directly (e.g. Realtime subscriptions).
 *
 * Never instantiate this in client code; route handlers and server components only.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env vars missing. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env.local",
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
