import type { NextApiRequest, NextApiResponse } from "next";
import { createApiClient, getSupabaseAdmin } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rateLimit";
import { FLAG_RATE_MAX, FLAG_RATE_WINDOW_S } from "@/lib/constants";
import type { FlaggedQuestion, QuestionFlagEntry } from "@/lib/supabase/types";

interface FlagRow {
  id:string; question_id:string; reason:QuestionFlagEntry["reason"]; comment:string;
  status:QuestionFlagEntry["status"]; created_at:string;
  profiles:{ full_name:string }|null;
  questions:{ question_text:string; options:string[]; correct_index:number; explanation:string;
    challenges:{ title:string }|null }|null;
}

// Admin-only: every dispute, grouped by question, newest activity first.
// correct_index is included ONLY here — the is_admin check below is the gate
// that keeps it off regular clients (see CLAUDE.md critical rules).
export default async function handler(req:NextApiRequest, res:NextApiResponse) {
  if (req.method!=="GET") { res.setHeader("Allow","GET"); return res.status(405).json({error:"Method not allowed."}); }
  const supabase=createApiClient(req,res);
  const { data:{user}, error:authErr } = await supabase.auth.getUser();
  if (authErr||!user) return res.status(401).json({error:"Not authenticated."});
  if (await rateLimit(`admin-flags:${user.id}`,FLAG_RATE_MAX,FLAG_RATE_WINDOW_S)) return res.status(429).json({error:"Too many requests."});
  const admin=getSupabaseAdmin();
  const { data:me, error:meErr } = await admin.from("profiles").select("is_admin").eq("id",user.id).single();
  if (meErr||!me?.is_admin) return res.status(403).json({error:"Not authorized."});

  const { data:rows, error:flagErr } = await admin.from("question_flags")
    .select("id,question_id,reason,comment,status,created_at,profiles(full_name),questions(question_text,options,correct_index,explanation,challenges(title))")
    .order("created_at",{ascending:false})
    .limit(500) as unknown as { data:FlagRow[]|null; error:{message:string}|null };
  if (flagErr||!rows) { console.error("[admin/flags]",flagErr); return res.status(500).json({error:"Failed to load disputes."}); }

  const byQuestion=new Map<string,FlaggedQuestion>();
  for (const r of rows) {
    let entry=byQuestion.get(r.question_id);
    if (!entry) {
      entry={
        question_id:r.question_id,
        question_text:r.questions?.question_text??"(question deleted)",
        options:r.questions?.options??[],
        correct_index:r.questions?.correct_index??-1,
        explanation:r.questions?.explanation??"",
        challenge_title:r.questions?.challenges?.title??"",
        open_count:0, flags:[],
      };
      byQuestion.set(r.question_id,entry);
    }
    if (r.status==="open") entry.open_count+=1;
    entry.flags.push({ id:r.id, reason:r.reason, comment:r.comment, status:r.status, created_at:r.created_at, flagger:r.profiles?.full_name??"(deleted)" });
  }
  // Questions with the most open disputes first.
  const questions=[...byQuestion.values()].sort((a,b)=>b.open_count-a.open_count);
  return res.status(200).json({ questions });
}
