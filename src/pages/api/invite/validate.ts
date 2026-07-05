import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { InviteCodeSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rateLimit";
import { getClientIP } from "@/lib/utils";
import { INVITE_RATE_LIMIT_MAX, INVITE_RATE_LIMIT_WINDOW_S } from "@/lib/constants";

export default async function handler(req:NextApiRequest, res:NextApiResponse) {
  if (req.method!=="POST") { res.setHeader("Allow","POST"); return res.status(405).json({error:"Method not allowed."}); }
  const ip=getClientIP(req);
  if (await rateLimit(`invite:${ip}`,INVITE_RATE_LIMIT_MAX,INVITE_RATE_LIMIT_WINDOW_S)) return res.status(429).json({error:"Too many attempts. Please wait a minute."});
  const parsed=InviteCodeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error:parsed.error.errors[0]?.message??"Invalid input."});
  try {
    const admin=getSupabaseAdmin();
    const { data:invite, error:fetchErr } = await admin.from("invite_codes").select("id,is_active,used_count,max_uses").eq("code",parsed.data.code).single();
    if (fetchErr||!invite||!invite.is_active||invite.used_count>=invite.max_uses) return res.status(400).json({error:"Invalid invite code."});
    // Atomic increment — lt() guard prevents race conditions exceeding max_uses
    const { error:updateErr } = await admin.from("invite_codes").update({used_count:invite.used_count+1}).eq("id",invite.id).lt("used_count",invite.max_uses).eq("is_active",true);
    if (updateErr) return res.status(400).json({error:"Invalid invite code."});
    return res.status(200).json({valid:true});
  } catch(err) { console.error("[invite/validate]",err); return res.status(503).json({error:"Service temporarily unavailable."}); }
}
