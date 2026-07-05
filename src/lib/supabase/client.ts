import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

let _client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getSupabaseBrowserClient() {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("[DTC] Missing Supabase env vars. Copy .env.example → .env.local");
  _client = createBrowserClient<Database>(url, anon);
  return _client;
}

export function getSupabase() { return getSupabaseBrowserClient(); }
