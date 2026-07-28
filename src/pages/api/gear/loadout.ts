import type { NextApiRequest, NextApiResponse } from "next";
import { createApiClient, getSupabaseAdmin } from "@/lib/supabase/server";
import { SetLoadoutSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rateLimit";
import { ATTEMPT_ANSWER_RATE_MAX, ATTEMPT_RATE_WINDOW_S } from "@/lib/constants";

// Replace the caller's box. Ownership is enforced twice: set_profile_loadout() re-checks it and
// raises a clear error, and the composite FK on profile_loadout makes an unowned decal
// impossible to insert even if that check were bypassed.
export default async function handler(req:NextApiRequest, res:NextApiResponse) {
  if (req.method!=="POST") { res.setHeader("Allow","POST"); return res.status(405).json({error:"Method not allowed."}); }
  const supabase=createApiClient(req,res);
  const { data:{user}, error:authErr } = await supabase.auth.getUser();
  if (authErr||!user) return res.status(401).json({error:"Not authenticated."});
  if (await rateLimit(`gear-loadout:${user.id}`,ATTEMPT_ANSWER_RATE_MAX,ATTEMPT_RATE_WINDOW_S)) return res.status(429).json({error:"Too many requests."});
  const parsed=SetLoadoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error:parsed.error.errors[0]?.message??"Invalid input."});

  const admin=getSupabaseAdmin();
  const { data, error } = await admin.rpc("set_profile_loadout",{p_user_id:user.id,p_slugs:parsed.data.slugs});
  if (error) {
    // The function raises for "not unlocked" / "too many" / duplicates — surface as a 400,
    // since those are all bad requests rather than server faults.
    console.error("[gear/loadout]",error);
    return res.status(400).json({error:"That decal isn't available to you."});
  }
  return res.status(200).json({equipped:(data??[]).map((r:{slug:string})=>r.slug)});
}
