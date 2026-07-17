import type { NextApiRequest, NextApiResponse } from "next";
import { createApiClient, getSupabaseAdmin } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rateLimit";
import type { ComebackQueueItem } from "@/lib/supabase/types";
import { ATTEMPT_CREATE_RATE_MAX, ATTEMPT_RATE_WINDOW_S, COMEBACK_QUEUE_SIZE } from "@/lib/constants";

// The bench queue: the user's open comebacks, oldest wound first (last_missed_at
// ascending — a re-miss bumps the timestamp, sending the tag to the back of the
// line). Questions are served without correct_index, same rule as the arena.
export default async function handler(req:NextApiRequest, res:NextApiResponse) {
  if (req.method!=="GET") { res.setHeader("Allow","GET"); return res.status(405).json({error:"Method not allowed."}); }
  const supabase=createApiClient(req,res);
  const { data:{user}, error:authErr } = await supabase.auth.getUser();
  if (authErr||!user) return res.status(401).json({error:"Not authenticated."});
  if (await rateLimit(`comeback-queue:${user.id}`,ATTEMPT_CREATE_RATE_MAX,ATTEMPT_RATE_WINDOW_S)) return res.status(429).json({error:"Too many requests."});
  const admin=getSupabaseAdmin();

  const { data:pile, error:pileErr } = await admin.from("comebacks")
    .select("question_id,missed_count,cleared_count,last_missed_at,cleared_at")
    .eq("user_id",user.id);
  if (pileErr) { console.error("[comeback/queue]",pileErr); return res.status(500).json({error:"Failed to load the pile."}); }

  const rows = pile??[];
  const open = rows.filter(r=>r.cleared_at===null)
    .sort((a,b)=>a.last_missed_at.localeCompare(b.last_missed_at));
  const clearedTotal = rows.reduce((n,r)=>n+r.cleared_count,0);
  const batch = open.slice(0,COMEBACK_QUEUE_SIZE);

  let items:ComebackQueueItem[] = [];
  if (batch.length>0) {
    const ids = batch.map(r=>r.question_id);
    const { data:questions, error:qErr } = await admin.from("questions")
      .select("id,challenge_id,difficulty,tier_order,question_text,options,explanation,created_at")
      .in("id",ids);
    if (qErr||!questions) { console.error("[comeback/queue]",qErr); return res.status(500).json({error:"Failed to load questions."}); }
    const challengeIds = Array.from(new Set(questions.map(q=>q.challenge_id)));
    const { data:challenges } = await admin.from("challenges").select("id,title").in("id",challengeIds);
    const titleById = new Map((challenges??[]).map(c=>[c.id,c.title]));
    const questionById = new Map(questions.map(q=>[q.id,q]));
    items = batch.flatMap(r=>{
      const q = questionById.get(r.question_id);
      if (!q) return [];
      // explanation is withheld until the answer lands, same as the arena
      const { explanation:_omit, ...safe } = q;
      return [{ question:{ ...safe, challenge_title:titleById.get(q.challenge_id)??"" }, missed_count:r.missed_count, last_missed_at:r.last_missed_at }];
    });
  }

  return res.status(200).json({ items, open_total:open.length, cleared_total:clearedTotal });
}
