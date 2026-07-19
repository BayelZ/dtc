import type { NextApiRequest, NextApiResponse } from "next";
import { createApiClient, getSupabaseAdmin } from "@/lib/supabase/server";
import { QuestionFlagSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rateLimit";
import { FLAG_RATE_MAX, FLAG_RATE_WINDOW_S } from "@/lib/constants";

// File a dispute against a question. One flag per user per question; a repeat
// flag from the same user updates their reason/comment and reopens it.
export default async function handler(req:NextApiRequest, res:NextApiResponse) {
  if (req.method!=="POST") { res.setHeader("Allow","POST"); return res.status(405).json({error:"Method not allowed."}); }
  const supabase=createApiClient(req,res);
  const { data:{user}, error:authErr } = await supabase.auth.getUser();
  if (authErr||!user) return res.status(401).json({error:"Not authenticated."});
  if (await rateLimit(`question-flag:${user.id}`,FLAG_RATE_MAX,FLAG_RATE_WINDOW_S)) return res.status(429).json({error:"Too many requests."});
  const parsed=QuestionFlagSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error:parsed.error.errors[0]?.message??"Invalid input."});
  const admin=getSupabaseAdmin();
  const { data:question, error:qErr } = await admin.from("questions").select("id").eq("id",parsed.data.question_id).single();
  if (qErr||!question) return res.status(404).json({error:"Question not found."});
  const { error:insErr } = await admin.from("question_flags").upsert({
    question_id:parsed.data.question_id, user_id:user.id,
    reason:parsed.data.reason, comment:parsed.data.comment, status:"open",
  },{ onConflict:"question_id,user_id" });
  if (insErr) { console.error("[question/flag]",insErr); return res.status(500).json({error:"Failed to file the dispute."}); }
  return res.status(200).json({ ok:true });
}
