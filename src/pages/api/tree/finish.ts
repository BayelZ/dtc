import type { NextApiRequest, NextApiResponse } from "next";
import { createApiClient, getSupabaseAdmin } from "@/lib/supabase/server";
import { FinishTreeSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rateLimit";
import { replay, withSeed, InvalidStepError, type Step } from "@/lib/tree/engine";
import { scoreTree, treeXpForAttempt } from "@/lib/tree/score";
import type { DiagChallenge } from "@/lib/tree/types";
import { ATTEMPT_ANSWER_RATE_MAX, ATTEMPT_RATE_WINDOW_S } from "@/lib/constants";

// Scores a finished run. Everything that decides XP is computed HERE from the stored path —
// the client sends only an attempt id. Mirrors the rule that XP/grade/tier are server-side.
export default async function handler(req:NextApiRequest, res:NextApiResponse) {
  if (req.method!=="POST") { res.setHeader("Allow","POST"); return res.status(405).json({error:"Method not allowed."}); }
  const supabase=createApiClient(req,res);
  const { data:{user}, error:authErr } = await supabase.auth.getUser();
  if (authErr||!user) return res.status(401).json({error:"Not authenticated."});
  if (await rateLimit(`tree-finish:${user.id}`,ATTEMPT_ANSWER_RATE_MAX,ATTEMPT_RATE_WINDOW_S)) return res.status(429).json({error:"Too many requests."});
  const parsed=FinishTreeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error:parsed.error.errors[0]?.message??"Invalid input."});
  const { attempt_id } = parsed.data;

  const admin=getSupabaseAdmin();
  const { data:attempt, error:attemptErr } = await admin.from("tree_attempts")
    .select("id,user_id,tree_id,seed_id,steps,completed,outcome,process_score,grade,xp_earned").eq("id",attempt_id).single();
  if (attemptErr||!attempt) return res.status(404).json({error:"Attempt not found."});
  if (attempt.user_id!==user.id) return res.status(403).json({error:"Forbidden."});
  if (attempt.completed) {
    const { data:profile } = await admin.from("profiles").select("xp,tier").eq("id",user.id).single();
    return res.status(200).json({ already_completed:true, outcome:attempt.outcome, process_score:attempt.process_score,
      grade:attempt.grade, xp_earned:attempt.xp_earned, new_total_xp:profile?.xp??0, tier:profile?.tier??"Bronze", tier_up:false });
  }

  const { data:row, error:treeErr } = await admin.from("challenge_trees").select("tree").eq("id",attempt.tree_id).single();
  if (treeErr||!row) return res.status(500).json({error:"Failed to load case."});
  const treeDoc=row.tree as DiagChallenge;
  const tree=withSeed(treeDoc, attempt.seed_id);
  const steps:Step[] = Array.isArray(attempt.steps) ? attempt.steps as Step[] : [];

  let run;
  try { run=replay(tree, steps); }
  catch (e) {
    if (e instanceof InvalidStepError) return res.status(409).json({error:"This run can't be scored — its recorded path is invalid."});
    console.error("[tree/finish] replay:",e); return res.status(500).json({error:"Failed to score the run."});
  }
  if (!run.resolved) return res.status(409).json({error:"This case isn't finished yet."});

  const outNode=treeDoc.nodes.find((n)=>n.id===run.nodeId);
  const score=scoreTree(run, treeDoc.scoringRules, { condition:outNode?.condition, nodeId:run.nodeId });

  // Anti-farming: decay on repeats of this exact (tree, seed) pair — a new fault in a
  // familiar case still pays full.
  const { count } = await admin.from("tree_attempts").select("id",{count:"exact",head:true})
    .eq("user_id",user.id).eq("tree_id",attempt.tree_id).eq("seed_id",attempt.seed_id).eq("completed",true);
  const xpAwarded=treeXpForAttempt(score.xpEarned,(count??0)+1);

  const { data:rpcResult, error:rpcErr } = await admin.rpc("complete_tree_attempt", {
    p_attempt_id:attempt_id, p_xp_earned:xpAwarded, p_outcome:score.kind,
    p_process_score:score.processScore, p_grade:score.grade,
    p_time_minutes:run.timeSpent, p_knowledge_correct:run.knowledgeCorrect, p_knowledge_total:run.knowledgeTotal,
  });
  if (rpcErr||!rpcResult) { console.error("[tree/finish] rpc:",rpcErr); return res.status(500).json({error:"Failed to finalize the run."}); }

  return res.status(200).json({
    outcome:score.kind, fixed:score.fixed, process_score:score.processScore, grade:score.grade,
    xp_earned:xpAwarded, xp_before_decay:score.xpEarned, repeat_number:(count??0)+1,
    knowledge_correct:run.knowledgeCorrect, knowledge_total:run.knowledgeTotal,
    time_minutes:run.timeSpent, node_id:run.nodeId,
    new_total_xp:rpcResult.new_xp, tier:rpcResult.tier, tier_up:rpcResult.tier_up,
  });
}
