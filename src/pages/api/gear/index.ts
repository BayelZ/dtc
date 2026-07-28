import type { NextApiRequest, NextApiResponse } from "next";
import { createApiClient, getSupabaseAdmin } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rateLimit";
import { ATTEMPT_ANSWER_RATE_MAX, ATTEMPT_RATE_WINDOW_S } from "@/lib/constants";

// The gear view: catalog + what this user has unlocked + what's on their box.
// Unlocks are evaluated here (server-side) — never in the browser. `unlock_rule` is deliberately
// NOT included in the response: the requirement TEXT is what a tech should see, the machine-
// readable rule is ours.
export default async function handler(req:NextApiRequest, res:NextApiResponse) {
  if (req.method!=="GET") { res.setHeader("Allow","GET"); return res.status(405).json({error:"Method not allowed."}); }
  const supabase=createApiClient(req,res);
  const { data:{user}, error:authErr } = await supabase.auth.getUser();
  if (authErr||!user) return res.status(401).json({error:"Not authenticated."});
  if (await rateLimit(`gear:${user.id}`,ATTEMPT_ANSWER_RATE_MAX,ATTEMPT_RATE_WINDOW_S)) return res.status(429).json({error:"Too many requests."});

  const admin=getSupabaseAdmin();

  // Re-evaluate every rule on read. Idempotent, and it means a decal earned by an action that
  // happened elsewhere (or a decal added to the catalog after the user qualified) shows up
  // without needing a backfill job.
  const { data:granted, error:grantErr } = await admin.rpc("grant_cosmetics",{p_user_id:user.id});
  if (grantErr) console.error("[gear] grant:",grantErr); // non-fatal: still show the catalog

  const [catalogRes, ownedRes, loadoutRes] = await Promise.all([
    admin.from("cosmetics").select("id,slug,name,requirement,kind,rarity,legend,color,sort_order").eq("is_active",true).order("sort_order"),
    admin.from("user_cosmetics").select("cosmetic_id").eq("user_id",user.id),
    admin.from("profile_loadout").select("slot,cosmetic_id").eq("user_id",user.id).order("slot"),
  ]);
  if (catalogRes.error) { console.error("[gear] catalog:",catalogRes.error); return res.status(500).json({error:"Failed to load gear."}); }

  const owned=new Set((ownedRes.data??[]).map(r=>r.cosmetic_id));
  const byId=new Map((catalogRes.data??[]).map(c=>[c.id,c.slug]));

  return res.status(200).json({
    catalog:(catalogRes.data??[]).map(c=>({...c, unlocked:owned.has(c.id)})),
    equipped:(loadoutRes.data??[]).map(r=>byId.get(r.cosmetic_id)).filter(Boolean),
    max_equipped:4,
    newly_unlocked:granted??[],
  });
}
