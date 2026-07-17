import type { NextApiRequest, NextApiResponse } from "next";
import { createApiClient, getSupabaseAdmin } from "@/lib/supabase/server";
import { ComebackAnswerSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rateLimit";
import { ATTEMPT_ANSWER_RATE_MAX, ATTEMPT_RATE_WINDOW_S } from "@/lib/constants";

// A bench answer. All judgment happens in record_comeback_answer() (SECURITY
// DEFINER): correctness check, clear/re-miss bookkeeping, streak credit,
// badge awards. Zero XP by design — this route never touches complete_attempt.
export default async function handler(req:NextApiRequest, res:NextApiResponse) {
  if (req.method!=="POST") { res.setHeader("Allow","POST"); return res.status(405).json({error:"Method not allowed."}); }
  const supabase=createApiClient(req,res);
  const { data:{user}, error:authErr } = await supabase.auth.getUser();
  if (authErr||!user) return res.status(401).json({error:"Not authenticated."});
  if (await rateLimit(`comeback-answer:${user.id}`,ATTEMPT_ANSWER_RATE_MAX,ATTEMPT_RATE_WINDOW_S)) return res.status(429).json({error:"Too many requests."});
  const parsed=ComebackAnswerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error:parsed.error.errors[0]?.message??"Invalid input."});
  const admin=getSupabaseAdmin();
  const { data:result, error:rpcErr } = await admin.rpc("record_comeback_answer", {
    p_user_id:user.id, p_question_id:parsed.data.question_id, p_selected:parsed.data.selected,
  });
  if (rpcErr) {
    if (rpcErr.message?.includes("no open comeback")) return res.status(409).json({error:"That job isn't on your pile."});
    console.error("[comeback/answer]",rpcErr);
    return res.status(500).json({error:"Failed to record the answer."});
  }
  return res.status(200).json(result);
}
