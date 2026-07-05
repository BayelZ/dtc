import type { NextApiRequest, NextApiResponse } from "next";
import { createApiClient, getSupabaseAdmin } from "@/lib/supabase/server";
import { CreateAttemptSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rateLimit";
import { ATTEMPT_CREATE_RATE_MAX, ATTEMPT_RATE_WINDOW_S, QUESTIONS_PER_SESSION } from "@/lib/constants";

export default async function handler(req:NextApiRequest, res:NextApiResponse) {
  if (req.method!=="POST") { res.setHeader("Allow","POST"); return res.status(405).json({error:"Method not allowed."}); }
  const supabase=createApiClient(req,res);
  const { data:{user}, error:authErr } = await supabase.auth.getUser();
  if (authErr||!user) return res.status(401).json({error:"Not authenticated."});
  if (await rateLimit(`attempt-create:${user.id}`,ATTEMPT_CREATE_RATE_MAX,ATTEMPT_RATE_WINDOW_S)) return res.status(429).json({error:"Too many attempts started."});
  const parsed=CreateAttemptSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error:parsed.error.errors[0]?.message??"Invalid input."});
  const admin=getSupabaseAdmin();
  const { data:challenge, error:challengeErr } = await admin.from("challenges").select("id").eq("id",parsed.data.challenge_id).eq("is_published",true).single();
  if (challengeErr||!challenge) return res.status(404).json({error:"Challenge not found."});
  const { data:attempt, error:insertErr } = await admin.from("attempts").insert({
    user_id:user.id, challenge_id:parsed.data.challenge_id, score:0, total_questions:QUESTIONS_PER_SESSION,
    xp_earned:0, speed_bonus_xp:0, time_seconds:0, answers:[], completed:false,
  }).select("id").single();
  if (insertErr||!attempt) { console.error("[attempt/create]",insertErr); return res.status(500).json({error:"Failed to create attempt."}); }
  return res.status(201).json({attempt_id:attempt.id});
}
