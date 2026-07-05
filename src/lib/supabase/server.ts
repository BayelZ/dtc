import { createServerClient, serializeCookieHeader } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { NextApiRequest, NextApiResponse } from "next";
import type { Database } from "./types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON) {
  throw new Error("[DTC] Missing env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Always call .auth.getUser() in API routes, NEVER .auth.getSession() — getUser() re-validates the JWT.
export function createApiClient(req: NextApiRequest, res: NextApiResponse) {
  return createServerClient<Database>(SUPABASE_URL!, SUPABASE_ANON!, {
    cookies: {
      getAll() { return Object.keys(req.cookies).map(name => ({ name, value: req.cookies[name] ?? "" })); },
      setAll(cookiesToSet: CookieToSet[]) {
        // Build the full array of serialized cookies, then set the header ONCE.
        // Do NOT call res.setHeader per-cookie inside the loop — each call
        // overwrites the previous one and silently drops earlier cookies.
        const serialized = cookiesToSet.map(({ name, value, options }) => serializeCookieHeader(name, value, options));
        const existing = res.getHeader("Set-Cookie");
        const all: string[] = [...(Array.isArray(existing) ? existing as string[] : existing ? [String(existing)] : []), ...serialized];
        res.setHeader("Set-Cookie", all);
      },
    },
  });
}

// Bypasses RLS. Only use after verifying the user via createApiClient().auth.getUser().
export function getSupabaseAdmin() {
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!service) throw new Error("[DTC] SUPABASE_SERVICE_ROLE_KEY is not set. Never prefix with NEXT_PUBLIC_.");
  return createClient<Database>(SUPABASE_URL!, service, { auth: { autoRefreshToken:false, persistSession:false } });
}
