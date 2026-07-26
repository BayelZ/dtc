// Pure diagnostic-tree engine. Shared by the client runner and the server scorer so the two
// can never disagree about what a run means.
//
// SECURITY MODEL (mirrors the correct_index rule in CLAUDE.md):
//   `faultSeeds` IS the answer key — it names the real fault, the test that reveals it, and every
//   seed-specific reading. It must NEVER be sent to the client. The client receives a tree passed
//   through sanitizeTreeForClient(); readings are released one node at a time by the server as the
//   tech actually performs each action.
import type { DiagChallenge, DiagNode, DiagOption, FaultSeed, SeedFault } from "@/lib/tree/types";
import { RESOLVE } from "@/lib/tree/types";

/** The tree shape safe to send to a browser: no seeds, no readings, no internal notes. */
export type ClientTree = Omit<DiagChallenge, "faultSeeds">;

export function sanitizeTreeForClient(tree: DiagChallenge): ClientTree {
  // Destructure the seeds off rather than deleting, so a new secret field added to
  // DiagChallenge is a type error here instead of a silent leak.
  const { faultSeeds: _answerKey, ...safe } = tree;
  return safe;
}

/** A single recorded decision. `option` indexes node.options; CONTINUE is a nextNodeId link. */
export const CONTINUE = -1;
export interface Step { from: string; option: number }

export interface RunState {
  nodeId: string;
  timeSpent: number;
  visited: string[];
  reasoning: number;
  decisionWeight: number | null;
  repairScope: "all-revealed" | "first-revealed" | null;
  repairExplicit: string[] | null;
  knowledgeCorrect: number;
  knowledgeTotal: number;
  resolved: { repaired: SeedFault[]; remaining: SeedFault[]; lucky: boolean } | null;
  steps: Step[];
}

export function initialRun(tree: DiagChallenge | ClientTree): RunState {
  const start = tree.nodes.find((n) => n.type === "intake") ?? tree.nodes[0];
  return {
    nodeId: start.id, timeSpent: 0, visited: [], reasoning: 0, decisionWeight: null,
    repairScope: null, repairExplicit: null, knowledgeCorrect: 0, knowledgeTotal: 0,
    resolved: null, steps: [],
  };
}

// Score a decision commitment by the evidence behind it:
//   committed to a fault you tested for and that's real -> full credit (diagnosed)
//   committed to a real fault you never tested for      -> minimal (a right hunch)
//   committed to a fault that isn't present             -> penalty (wrong hypothesis)
export function commitScore(seed: FaultSeed, opt: DiagOption, visited: string[]): number {
  if (!opt.commitsTo) return opt.scoreWeight;
  const fault = seed.activeFaults.find((f) => f.id === opt.commitsTo);
  if (!fault) return -3;
  return visited.includes(fault.revealedBy) ? 6 : 1;
}

/** Faults revealed, in the order the tech ran the tests that show them. */
export function revealedInOrder(seed: FaultSeed, visited: string[]): SeedFault[] {
  const out: SeedFault[] = [];
  for (const v of visited) {
    const f = seed.activeFaults.find((p) => p.revealedBy === v && !out.includes(p));
    if (f) out.push(f);
  }
  return out;
}

export class InvalidStepError extends Error {}

/** The legal successors of a node: its options, plus a CONTINUE link if it has nextNodeId. */
function targetFor(node: DiagNode, option: number): { targetId: string; opt: DiagOption } {
  if (option === CONTINUE) {
    if (!node.nextNodeId) throw new InvalidStepError(`Node "${node.id}" has no nextNodeId to continue through`);
    return { targetId: node.nextNodeId, opt: { label: node.continueLabel ?? "Continue", targetNodeId: node.nextNodeId, scoreWeight: 0 } };
  }
  const opt = node.options?.[option];
  if (!opt) throw new InvalidStepError(`Node "${node.id}" has no option at index ${option}`);
  return { targetId: opt.targetNodeId, opt };
}

export interface StepResult {
  run: RunState;
  /** Seed-specific readout for the node just entered, or undefined. Server-released. */
  reading?: string;
  /** Quiz feedback for the option just taken, when the node left was a quiz. */
  quiz?: { correct: boolean; explanation?: string; label: string };
  done: boolean;
}

/**
 * Apply one choice. Validates the transition against the tree, so a client cannot invent a
 * path (e.g. jump straight to a repair, or claim a test it never ran).
 */
export function applyChoice(tree: DiagChallenge, run: RunState, option: number): StepResult {
  const seed = currentSeed(tree, run);
  const byId = Object.fromEntries(tree.nodes.map((n) => [n.id, n]));
  const from = byId[run.nodeId];
  if (!from) throw new InvalidStepError(`Unknown node "${run.nodeId}"`);
  if (run.resolved) throw new InvalidStepError("Run already finished");

  const { targetId, opt } = targetFor(from, option);
  const isQuiz = from.type === "quiz";
  const steps = [...run.steps, { from: run.nodeId, option }];
  const knowledgeTotal = run.knowledgeTotal + (isQuiz ? 1 : 0);
  const knowledgeCorrect = run.knowledgeCorrect + (isQuiz && opt.correct ? 1 : 0);
  const quiz = isQuiz ? { correct: !!opt.correct, explanation: from.explanation, label: opt.label } : undefined;

  // Resolver: compute the ending from what was repaired vs. the seed's real faults.
  if (targetId === RESOLVE) {
    const revealed = revealedInOrder(seed, run.visited);
    const scopeR = run.repairScope === "all-revealed" ? revealed : run.repairScope === "first-revealed" ? revealed.slice(0, 1) : [];
    const explicitR = seed.activeFaults.filter((f) => (run.repairExplicit ?? []).includes(f.id));
    const repaired = Array.from(new Set([...scopeR, ...explicitR]));
    const remaining = seed.activeFaults.filter((p) => !repaired.includes(p));
    // fixed a component without ever running the test that reveals it = lucky, not diagnosed
    const lucky = explicitR.some((f) => !revealed.includes(f));
    const cond = remaining.length === 0 ? "all-faults-repaired" : "faults-remain";
    const out = tree.nodes.find((n) => n.type === "outcome" && n.condition === cond) ?? tree.nodes.find((n) => n.type === "outcome")!;
    return {
      run: { ...run, nodeId: out.id, knowledgeCorrect, knowledgeTotal, steps, resolved: { repaired, remaining, lucky } },
      quiz, done: true,
    };
  }

  const target = byId[targetId];
  if (!target) throw new InvalidStepError(`Option targets missing node "${targetId}"`);
  const enterTime = target.timeCost ?? 0;

  const run2: RunState = {
    nodeId: target.id,
    timeSpent: run.timeSpent + enterTime,
    visited: [...run.visited, target.id],
    reasoning: from.type === "intake" || from.type === "action" ? run.reasoning + opt.scoreWeight : run.reasoning,
    decisionWeight: from.type === "decision" ? commitScore(seed, opt, run.visited) : run.decisionWeight,
    repairScope: target.repairScope ?? run.repairScope,
    repairExplicit: target.repairs ?? run.repairExplicit,
    knowledgeCorrect, knowledgeTotal,
    resolved: run.resolved,
    steps,
  };
  return { run: run2, reading: seed.resultOverrides[target.id], quiz, done: target.type === "outcome" };
}

// The seed is carried on the tree object the SERVER holds (it picked it at start).
// Attached out-of-band so RunState stays serializable and seed-free in transit.
const SEED_KEY = "__seedId" as const;
export type SeededTree = DiagChallenge & { [SEED_KEY]?: string };

export function withSeed(tree: DiagChallenge, seedId: string): SeededTree {
  return { ...tree, [SEED_KEY]: seedId };
}

function currentSeed(tree: DiagChallenge, _run: RunState): FaultSeed {
  const id = (tree as SeededTree)[SEED_KEY];
  const seed = id ? tree.faultSeeds.find((s) => s.id === id) : undefined;
  if (!seed) throw new InvalidStepError("Tree has no active seed — call withSeed() first");
  return seed;
}

/** Replay a recorded step list from the start. The server's source of truth for a finished run. */
export function replay(tree: DiagChallenge, steps: Step[]): RunState {
  let run = initialRun(tree);
  for (const s of steps) {
    if (s.from !== run.nodeId) throw new InvalidStepError(`Step out of order: expected node "${run.nodeId}", got "${s.from}"`);
    run = applyChoice(tree, run, s.option).run;
  }
  return run;
}

export function pickSeedId(tree: DiagChallenge): string {
  return tree.faultSeeds[Math.floor(Math.random() * tree.faultSeeds.length)].id;
}
