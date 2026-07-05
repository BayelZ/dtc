import type { NextApiRequest, NextApiResponse } from "next";
import { createApiClient, getSupabaseAdmin } from "@/lib/supabase/server";
import { FinishAttemptSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rateLimit";
import { computeXP, computeTotalSpeedBonus } from "@/lib/utils";
import type { AnswerRecord } from "@/lib/supabase/types";
import { ATTEMPT_ANSWER_RATE_MAX, ATTEMPT_RATE_WINDOW_S, QUESTIONS_PER_SESSION } from "@/lib/constants";

export default async function handler(req:NextApiRequest, res:NextApiResponse) {
  if (req.method!=="POST") { res.setHeader("Allow","POST"); return res.status(405).json({error:"Method not allowed."}); }
  const supabase=createApiClient(req,res);
  const { data:{user}, error:authErr } = await supabase.auth.getUser();
  if (authErr||!user) return res.status(401).json({error:"Not authenticated."});
  if (await rateLimit(`attempt-finish:${user.id}`,ATTEMPT_ANSWER_RATE_MAX,ATTEMPT_RATE_WINDOW_S)) return res.status(429).json({error:"Too many requests."});
  const parsed=FinishAttemptSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error:parsed.error.errors[0]?.message??"Invalid input."});
  const { attempt_id } = parsed.data;
  const admin=getSupabaseAdmin();
  const { data:attempt, error:attemptErr } = await admin.from("attempts").select("id,user_id,challenge_id,answers,score,total_questions,xp_earned,grade,completed").eq("id",attempt_id).single();
  if (attemptErr||!attempt) return res.status(404).json({error:"Attempt not found."});
  if (attempt.user_id!==user.id) return res.status(403).json({error:"Forbidden."});
  if (attempt.completed) {
    const { data:profile } = await admin.from("profiles").select("xp,tier").eq("id",user.id).single();
    return res.status(200).json({ already_completed:true, score:attempt.score, total:attempt.total_questions, grade:attempt.grade??"F", xp_earned:attempt.xp_earned, speed_bonus:0, new_total_xp:profile?.xp??0, tier:profile?.tier??"Bronze", tier_up:false });
  }
  // BUG FIX: defensively handle null/non-array answers
  const answers:AnswerRecord[] = Array.isArray(attempt.answers) ? attempt.answers : [];
  const serverScore=answers.filter(a=>a.is_correct).length;
  const { data:challenge, error:challengeErr } = await admin.from("challenges").select("xp_reward").eq("id",attempt.challenge_id).single();
  if (challengeErr||!challenge) return res.status(500).json({error:"Failed to load challenge."});
  const baseXP=computeXP(challenge.xp_reward,serverScore,QUESTIONS_PER_SESSION);
  const speedBonus=computeTotalSpeedBonus(answers,challenge.xp_reward);
  const totalSeconds=answers.reduce((s,a)=>s+(a.time_taken_s??45),0);
  const { data:rpcResult, error:rpcErr } = await admin.rpc("complete_attempt", {
    p_attempt_id:attempt_id, p_xp_earned:baseXP, p_speed_bonus:speedBonus, p_time_seconds:totalSeconds,
  });
  if (rpcErr||!rpcResult) { console.error("[attempt/finish] rpc:",rpcErr); return res.status(500).json({error:"Failed to finalize attempt."}); }
  return res.status(200).json({
    score:serverScore, total:QUESTIONS_PER_SESSION, grade:rpcResult.grade, xp_earned:baseXP,
    speed_bonus:speedBonus, new_total_xp:rpcResult.new_xp, tier:rpcResult.tier, tier_up:rpcResult.tier_up,
  });
}
