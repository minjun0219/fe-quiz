import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

let cached: SupabaseClient<Database> | null = null;

/**
 * Server-side Supabase client.
 * Uses the publishable key — RLS policies on `shares` allow anon INSERT/SELECT,
 * which is fine because all writes go through validated route handlers.
 *
 * Never instantiate this in client code; route handlers and server components only.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local",
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
