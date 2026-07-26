import type { NextApiRequest, NextApiResponse } from "next";
import { createApiClient, getSupabaseAdmin } from "@/lib/supabase/server";
import { TreeStepSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rateLimit";
import { replay, applyChoice, withSeed, InvalidStepError, type Step } from "@/lib/tree/engine";
import type { DiagChallenge } from "@/lib/tree/types";
import { ATTEMPT_ANSWER_RATE_MAX, ATTEMPT_RATE_WINDOW_S } from "@/lib/constants";

// Takes ONE step through the tree. The server replays the stored path, validates that the
// requested transition is legal from where the run actually is, appends it, and releases only
// that node's reading. A client cannot skip tests, invent a path, or read ahead.
export default async function handler(req:NextApiRequest, res:NextApiResponse) {
  if (req.method!=="POST") { res.setHeader("Allow","POST"); return res.status(405).json({error:"Method not allowed."}); }
  const supabase=createApiClient(req,res);
  const { data:{user}, error:authErr } = await supabase.auth.getUser();
  if (authErr||!user) return res.status(401).json({error:"Not authenticated."});
  if (await rateLimit(`tree-step:${user.id}`,ATTEMPT_ANSWER_RATE_MAX,ATTEMPT_RATE_WINDOW_S)) return res.status(429).json({error:"Too many requests."});
  const parsed=TreeStepSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error:parsed.error.errors[0]?.message??"Invalid input."});
  const { attempt_id, from_node_id, option } = parsed.data;

  const admin=getSupabaseAdmin();
  const { data:attempt, error:attemptErr } = await admin.from("tree_attempts")
    .select("id,user_id,tree_id,seed_id,steps,completed").eq("id",attempt_id).single();
  if (attemptErr||!attempt) return res.status(404).json({error:"Attempt not found."});
  if (attempt.user_id!==user.id) return res.status(403).json({error:"Forbidden."});
  if (attempt.completed) return res.status(409).json({error:"This case is already finished."});

  const { data:row, error:treeErr } = await admin.from("challenge_trees").select("tree").eq("id",attempt.tree_id).single();
  if (treeErr||!row) return res.status(500).json({error:"Failed to load case."});
  const tree=withSeed(row.tree as DiagChallenge, attempt.seed_id);

  const steps:Step[] = Array.isArray(attempt.steps) ? attempt.steps as Step[] : [];
  try {
    const current=replay(tree, steps);
    // The client must be where the server thinks it is — catches a stale or forged request.
    if (current.nodeId!==from_node_id) return res.status(409).json({error:"Out of sync with the server. Reload the case."});
    const result=applyChoice(tree, current, option);
    const { error:updErr } = await admin.from("tree_attempts").update({ steps: result.run.steps }).eq("id",attempt_id);
    if (updErr) { console.error("[tree/step]",updErr); return res.status(500).json({error:"Failed to record step."}); }
    return res.status(200).json({
      node_id: result.run.nodeId,
      reading: result.reading ?? null,   // seed-specific, released only now
      quiz: result.quiz ?? null,
      time_spent: result.run.timeSpent,
      done: result.done,
    });
  } catch (e) {
    if (e instanceof InvalidStepError) return res.status(400).json({error:"That move isn't available here."});
    console.error("[tree/step] unexpected:",e);
    return res.status(500).json({error:"Failed to take that step."});
  }
}
