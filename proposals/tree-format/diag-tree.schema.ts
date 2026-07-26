// Zod schema for the branching diagnostic-tree pilot format.
// Mirrors the DiagChallenge interface from the pilot spec. Kept in /proposals
// (NOT src/) because this is a review artifact, not wired into the app yet.
// Matches the repo's validation style (see src/lib/validations.ts).
import { z } from "zod";

export const NodeType = z.enum([
  "intake", "action", "result", "decision", "repair", "outcome", "quiz",
]);

export const DiagOptionSchema = z.object({
  label: z.string().min(1),
  targetNodeId: z.string().min(1),
  scoreWeight: z.number().int(), // may be negative — dead ends cost points, not the run
  commitsTo: z.string().optional(), // decision options: fault id committed to (evidence-based scoring)
  correct: z.boolean().optional(), // quiz options: marks the right answer (knowledge-axis scoring)
});

export const DiagNodeSchema = z.object({
  id: z.string().min(1),
  type: NodeType,
  prompt: z.string().min(1),
  timeCost: z.number().min(0).optional(), // minutes; action/repair nodes only
  options: z.array(DiagOptionSchema).min(1).optional(), // branch: 2+ real choices
  nextNodeId: z.string().min(1).optional(), // non-branching link: the single successor (node id, or RESOLVE)
  continueLabel: z.string().min(1).optional(), // caption for the unscored "Continue" control on a nextNodeId node
  repairScope: z.enum(["all-revealed", "first-revealed"]).optional(), // repair: fix what testing revealed
  repairs: z.array(z.string()).optional(), // repair: explicit fault ids (e.g. a component swap)
  condition: z.enum(["all-faults-repaired", "faults-remain", "wrong-system"]).optional(), // outcome nodes only
  explanation: z.string().min(1).optional(), // quiz: teaching point shown after answering
});

export const SeedFaultSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  revealedBy: z.string().min(1), // nodeId of the test that reveals this fault under load
});

export const FaultSeedSchema = z.object({
  id: z.string().min(1),
  internalNote: z.string().min(1),
  activeFaults: z.array(SeedFaultSchema).min(1), // the faults actually present this run
  resultOverrides: z.record(z.string(), z.string()), // nodeId -> seed-specific text
});

// Sentinel option target: "runner computes the outcome from repaired vs. actual faults".
export const RESOLVE = "#resolve";

export const ScoringRulesSchema = z.object({
  decisionNodeWeight: z.number(),
  pathEfficiencyWeight: z.number(),
  repairSelectionWeight: z.number(),
  timeBudgetMinutes: z.number().positive(),
});

export const DiagChallengeSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    vehicle: z.object({
      year: z.number().int(),
      make: z.string().min(1),
      model: z.string().min(1),
      engine: z.string().optional(),
    }),
    complaintTemplate: z.string().min(1),
    faultSeeds: z.array(FaultSeedSchema).min(2), // 2+ variants sharing this tree shape
    nodes: z.array(DiagNodeSchema).min(1),
    scoringRules: ScoringRulesSchema,
  })
  .superRefine((c, ctx) => {
    const ids = new Set<string>();
    for (const n of c.nodes) {
      if (ids.has(n.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nodes"], message: `Duplicate node id: ${n.id}` });
      }
      ids.add(n.id);
    }
    // every fault id declared across all seeds — commitsTo / repairs must reference one of these
    const faultIds = new Set<string>();
    for (const s of c.faultSeeds) for (const f of s.activeFaults) faultIds.add(f.id);
    // map: repair node id -> its single explicit repair fault id (for commitsTo consistency)
    const repairNodeFault = new Map<string, string>();
    for (const n of c.nodes) {
      if (n.type === "repair" && n.repairs && n.repairs.length === 1) repairNodeFault.set(n.id, n.repairs[0]);
    }
    for (const n of c.nodes) {
      // referential integrity — every option must point at a real node (or the resolver sentinel)
      for (const o of n.options ?? []) {
        if (o.targetNodeId !== RESOLVE && !ids.has(o.targetNodeId)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nodes"], message: `Option in "${n.id}" targets missing node "${o.targetNodeId}"` });
        }
        // commitsTo must name a real fault, and must agree with the repair it routes to
        if (o.commitsTo) {
          if (!faultIds.has(o.commitsTo)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nodes"], message: `Option in "${n.id}" commitsTo unknown fault "${o.commitsTo}" (not in any seed)` });
          }
          const routedFault = repairNodeFault.get(o.targetNodeId);
          if (routedFault && routedFault !== o.commitsTo) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nodes"], message: `Option in "${n.id}" commitsTo "${o.commitsTo}" but routes to repair "${o.targetNodeId}" which fixes "${routedFault}"` });
          }
        }
      }
      // quiz nodes: a knowledge check — options are answers, exactly one marked correct
      if (n.type === "quiz") {
        const marked = (n.options ?? []).filter((o) => o.correct === true).length;
        if (marked !== 1) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nodes"], message: `Quiz node "${n.id}" needs exactly one option marked correct (has ${marked})` });
        }
        if (n.nextNodeId) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nodes"], message: `Quiz node "${n.id}" routes via its answer options, not nextNodeId` });
        }
      }
      // the `correct` flag only means something on a quiz node's options
      if (n.type !== "quiz" && (n.options ?? []).some((o) => o.correct !== undefined)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nodes"], message: `Node "${n.id}" (${n.type}) has a "correct" option flag — only valid on quiz nodes` });
      }
      // a node branches (options) OR links (nextNodeId) — never both
      if (n.options && n.nextNodeId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nodes"], message: `Node "${n.id}" has both options and nextNodeId — a node branches or links, not both` });
      }
      // a real branch is 2+ choices; a single "choice" is a linear link, use nextNodeId
      if ((n.options?.length ?? 0) === 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nodes"], message: `Node "${n.id}" has a single option — use nextNodeId for a non-branching link` });
      }
      // nextNodeId must reference a real node (or the resolver sentinel)
      if (n.nextNodeId && n.nextNodeId !== RESOLVE && !ids.has(n.nextNodeId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nodes"], message: `Node "${n.id}" nextNodeId targets missing node "${n.nextNodeId}"` });
      }
      // continueLabel only makes sense on a linking node
      if (n.continueLabel && !n.nextNodeId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nodes"], message: `Node "${n.id}" has continueLabel but no nextNodeId` });
      }
      // repairs must reference real faults
      for (const rid of n.repairs ?? []) {
        if (!faultIds.has(rid)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nodes"], message: `Repair node "${n.id}" repairs unknown fault "${rid}" (not in any seed)` });
        }
      }
      if (n.repairScope && n.type !== "repair") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nodes"], message: `repairScope is only valid on repair nodes ("${n.id}" is ${n.type})` });
      }
      if (n.condition && n.type !== "outcome") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nodes"], message: `condition is only valid on outcome nodes ("${n.id}" is ${n.type})` });
      }
      // convention: timed nodes are actions and repairs
      if ((n.type === "action" || n.type === "repair") && n.timeCost === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nodes"], message: `${n.type} node "${n.id}" needs a timeCost (book-time minutes)` });
      }
      // outcome nodes are terminal
      if (n.type === "outcome" && ((n.options?.length ?? 0) > 0 || n.nextNodeId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nodes"], message: `Outcome node "${n.id}" must be terminal (no options or nextNodeId)` });
      }
    }
    if (!c.nodes.some((n) => n.type === "decision")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nodes"], message: "Tree needs at least one decision node (the moment of truth)" });
    }
    if (!c.nodes.some((n) => n.type === "outcome")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nodes"], message: "Tree needs at least one outcome node" });
    }
    // at least one real dead end — a negative-weight option the tech can take and recover from
    if (!c.nodes.some((n) => (n.options ?? []).some((o) => o.scoreWeight < 0))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nodes"], message: "Tree needs at least one dead-end (negative scoreWeight) option" });
    }
    // seed override keys + fault revealedBy must reference real nodes
    for (const s of c.faultSeeds) {
      for (const k of Object.keys(s.resultOverrides)) {
        if (!ids.has(k)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["faultSeeds"], message: `Seed "${s.id}" overrides unknown node "${k}"` });
        }
      }
      for (const f of s.activeFaults) {
        if (!ids.has(f.revealedBy)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["faultSeeds"], message: `Seed "${s.id}" fault "${f.id}" revealedBy unknown node "${f.revealedBy}"` });
        }
      }
    }
    // if anything resolves (via an option target or a repair's nextNodeId), the seed-aware outcome nodes must exist
    const resolves = c.nodes.some((n) => n.nextNodeId === RESOLVE || (n.options ?? []).some((o) => o.targetNodeId === RESOLVE));
    if (resolves) {
      for (const cond of ["all-faults-repaired", "faults-remain"] as const) {
        if (!c.nodes.some((n) => n.type === "outcome" && n.condition === cond)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["nodes"], message: `Resolver needs an outcome node with condition "${cond}"` });
        }
      }
    }
  });

export type DiagChallenge = z.infer<typeof DiagChallengeSchema>;
