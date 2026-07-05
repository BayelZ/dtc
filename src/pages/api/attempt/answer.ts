import type { NextApiRequest, NextApiResponse } from "next";
import { createApiClient, getSupabaseAdmin } from "@/lib/supabase/server";
import { SubmitAnswerSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rateLimit";
import type { AnswerRecord } from "@/lib/supabase/types";
import { ATTEMPT_ANSWER_RATE_MAX, ATTEMPT_RATE_WINDOW_S, QUESTIONS_PER_SESSION, QUESTION_TIME_SECONDS } from "@/lib/constants";

export default async function handler(req:NextApiRequest, res:NextApiResponse) {
  if (req.method!=="POST") { res.setHeader("Allow","POST"); return res.status(405).json({error:"Method not allowed."}); }
  const supabase=createApiClient(req,res);
  const { data:{user}, error:authErr } = await supabase.auth.getUser();
  if (authErr||!user) return res.status(401).json({error:"Not authenticated."});
  if (await rateLimit(`attempt-answer:${user.id}`,ATTEMPT_ANSWER_RATE_MAX,ATTEMPT_RATE_WINDOW_S)) return res.status(429).json({error:"Too many requests."});
  const parsed=SubmitAnswerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error:parsed.error.errors[0]?.message??"Invalid input."});
  const { attempt_id, question_id, tier_order, selected, time_taken_s } = parsed.data;
  const timeTaken=Math.max(1,Math.min(time_taken_s??QUESTION_TIME_SECONDS,QUESTION_TIME_SECONDS));
  const admin=getSupabaseAdmin();
  const { data:attempt, error:attemptErr } = await admin.from("attempts").select("id,user_id,challenge_id,answers,score,completed").eq("id",attempt_id).single();
  if (attemptErr||!attempt) return res.status(404).json({error:"Attempt not found."});
  if (attempt.user_id!==user.id) return res.status(403).json({error:"Forbidden."});
  if (attempt.completed) return res.status(409).json({error:"Attempt already completed."});
  // BUG FIX: defensively handle null/non-array answers
  const existingAnswers:AnswerRecord[] = Array.isArray(attempt.answers) ? attempt.answers : [];
  if (existingAnswers.length>=QUESTIONS_PER_SESSION) return res.status(409).json({error:"All questions already answered."});
  const { data:question, error:questionErr } = await admin.from("questions").select("id,correct_index,explanation,options").eq("id",question_id).eq("challenge_id",attempt.challenge_id).single();
  if (questionErr||!question) return res.status(404).json({error:"Question not found."});
  const isCorrect = selected!==-1 && selected===question.correct_index;
  const newAnswer:AnswerRecord = { question_id, tier_order, selected, correct:question.correct_index, is_correct:isCorrect, time_taken_s:timeTaken };
  const allAnswers=[...existingAnswers,newAnswer];
  const newScore=allAnswers.filter(a=>a.is_correct).length;
  const { error:updateErr } = await admin.from("attempts").update({answers:allAnswers,score:newScore}).eq("id",attempt_id);
  if (updateErr) { console.error("[attempt/answer]",updateErr); return res.status(500).json({error:"Failed to save answer."}); }
  return res.status(200).json({ is_correct:isCorrect, correct_index:question.correct_index, explanation:question.explanation, answers_count:allAnswers.length });
}
