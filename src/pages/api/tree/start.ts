import type { NextApiRequest, NextApiResponse } from "next";
import { createApiClient, getSupabaseAdmin } from "@/lib/supabase/server";
import { StartTreeSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rateLimit";
import { sanitizeTreeForClient, pickSeedId, initialRun } from "@/lib/tree/engine";
import type { DiagChallenge } from "@/lib/tree/types";
import { ATTEMPT_CREATE_RATE_MAX, ATTEMPT_RATE_WINDOW_S } from "@/lib/constants";

// Starts a diagnostic-tree run. The SERVER draws the fault seed and keeps it — the response
// carries the tree with faultSeeds stripped, so the answer key never reaches the browser.
export default async function handler(req:NextApiRequest, res:NextApiResponse) {
  if (req.method!=="POST") { res.setHeader("Allow","POST"); return res.status(405).json({error:"Method not allowed."}); }
  const supabase=createApiClient(req,res);
  const { data:{user}, error:authErr } = await supabase.auth.getUser();
  if (authErr||!user) return res.status(401).json({error:"Not authenticated."});
  if (await rateLimit(`tree-start:${user.id}`,ATTEMPT_CREATE_RATE_MAX,ATTEMPT_RATE_WINDOW_S)) return res.status(429).json({error:"Too many attempts started."});
  const parsed=StartTreeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error:parsed.error.errors[0]?.message??"Invalid input."});

  const admin=getSupabaseAdmin();
  const { data:row, error:treeErr } = await admin.from("challenge_trees")
    .select("id,tree").eq("slug",parsed.data.slug).eq("is_published",true).single();
  if (treeErr||!row) return res.status(404).json({error:"Case not found."});

  const tree=row.tree as DiagChallenge;
  const seedId=pickSeedId(tree);
  const { data:attempt, error:insertErr } = await admin.from("tree_attempts").insert({
    user_id:user.id, tree_id:row.id, seed_id:seedId, steps:[], completed:false,
  }).select("id").single();
  if (insertErr||!attempt) { console.error("[tree/start]",insertErr); return res.status(500).json({error:"Failed to start case."}); }

  const start=initialRun(tree);
  return res.status(201).json({
    attempt_id:attempt.id,
    tree:sanitizeTreeForClient(tree), // NO faultSeeds — readings are released per node by /step
    node_id:start.nodeId,
  });
}
