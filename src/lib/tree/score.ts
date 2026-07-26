// Tree scoring → economy mapping (pilot). Pure + framework-free so it can be unit-tested
// and, eventually, moved server-side to feed the real XP economy the way complete_attempt()
// does for MCQ. The design splits TWO axes that the prototype used to conflate:
//
//   AXIS 1 · OUTCOME (binary)  — did the vehicle leave fixed? This GATES the economy.
//       clean / lucky  → "fixed": earns XP.
//       comeback / masked → ZERO XP by design; lands on the Rework Bench (mirrors the MCQ
//       comeback pile) and breaks the clean-sheet streak. A comeback is never a pass.
//
//   AXIS 2 · PROCESS SCORE (0–100 → letter grade) — how clean was the reasoning, computed
//       INDEPENDENTLY of the outcome so it's shown even on a comeback, and used as the
//       magnitude of the payout on a fixed RO.
import type { Grade } from "@/lib/supabase/types";
import { scoreToGrade, retryDecayRate } from "@/lib/utils";

// XP a flawless, fully-diagnosed fix pays. Calibrated against the MCQ economy (see
// proposals/tree-format/SCORING-ECONOMY.md §Economy calibration):
//   * mean challenge xp_reward is ~143; a perfect+fast 10-question session pays ~213.
//   * a tree run is longer and harder, BUT it is all-or-nothing — a comeback pays 0, where
//     MCQ still pays partial credit for partial correctness. So the headline number must be
//     read risk-adjusted: expected = P(fix) x grade x base.
//       novice  (P .30, grade .70) -> ~52   (below an MCQ session — guessing is punished)
//       mid     (P .55, grade .80) -> ~110  (comparable to a strong MCQ session)
//       skilled (P .85, grade .90) -> ~191  (above MCQ — skill is rewarded)
//   That spread is the point: XP feeds the shop/hiring portal, so it should track competence,
//   not time served.
export const TREE_BASE_XP = 250;

export type OutcomeKind = "clean" | "lucky" | "comeback" | "masked";

export interface ScoringRules {
  decisionNodeWeight: number;
  pathEfficiencyWeight: number;
  repairSelectionWeight: number;
  timeBudgetMinutes: number;
}

// The parts of a run the scorer needs (subset of the runner's RunState).
export interface ScorableRun {
  reasoning: number;
  decisionWeight: number | null;
  repairScope: "all-revealed" | "first-revealed" | null;
  repairExplicit: string[] | null;
  resolved: { repaired: unknown[]; remaining: unknown[]; lucky: boolean } | null;
  timeSpent: number;
  knowledgeCorrect: number; // interleaved procedure-quiz answers gotten right
  knowledgeTotal: number;   // quizzes actually presented this run (0 → knowledge axis omitted)
}

export interface TreeScore {
  kind: OutcomeKind;
  fixed: boolean;          // outcome gate: clean|lucky
  processScore: number;    // 0..100
  grade: Grade;
  xpEarned: number;        // 0 unless fixed
  // breakdown lines (for the process report)
  decisionPts: number;
  repairWeight: number | null;
  repairPts: number;
  repairNote: string;
  effPts: number;
  over: number;            // minutes over (positive) / under (negative) budget
  knowledgeCorrect: number;
  knowledgeTotal: number;  // 0 → no procedure quizzes in this case; hide the line
}

export function scoreTree(
  run: ScorableRun,
  rules: ScoringRules,
  outcome: { condition?: "all-faults-repaired" | "faults-remain" | "wrong-system"; nodeId: string },
): TreeScore {
  const res = run.resolved;
  const good = outcome.condition ? outcome.condition === "all-faults-repaired" : outcome.nodeId === "out_good";
  const masked = outcome.condition === "wrong-system";

  // ── AXIS 1 · OUTCOME ──
  const kind: OutcomeKind = masked ? "masked" : good ? (res?.lucky ? "lucky" : "clean") : "comeback";
  const fixed = kind === "clean" || kind === "lucky";

  // ── AXIS 2 · PROCESS ──
  const decisionPts = (run.decisionWeight ?? 0) * rules.decisionNodeWeight;

  // Repair selection scored on what was actually fixed vs. the real fault — not a constant.
  const enteredRepair = run.repairExplicit !== null || run.repairScope !== null;
  const repairWeight: number | null = !enteredRepair
    ? null
    : res && res.remaining.length === 0
      ? res.lucky ? 0 : 2
      : res && res.repaired.length > 0 ? 0 : -2;
  const repairNote = repairWeight === null ? "no repair made"
    : repairWeight === 2 ? `×${rules.repairSelectionWeight}`
    : repairWeight === 0 ? (res?.lucky ? "right part, never diagnosed" : "incomplete")
    : "wrong component";
  const repairPts = (repairWeight ?? 0) * rules.repairSelectionWeight;

  const over = run.timeSpent - rules.timeBudgetMinutes;
  const effPts = Math.round((rules.pathEfficiencyWeight * (rules.timeBudgetMinutes - run.timeSpent) / rules.timeBudgetMinutes) * 10);

  // Normalize each factor to 0..1, roll up to 0..100, grade on the SAME thresholds MCQ uses.
  const dxNorm = run.decisionWeight === null ? 0 : run.decisionWeight >= 6 ? 1 : run.decisionWeight >= 1 ? 0.4 : 0;
  const rpNorm = repairWeight === null ? 0 : repairWeight >= 2 ? 1 : repairWeight === 0 ? (res?.lucky ? 0.5 : 0.25) : 0;
  const timeEff = Math.max(0, Math.min(1, (2 * rules.timeBudgetMinutes - run.timeSpent) / rules.timeBudgetMinutes));
  const pathAdj = Math.max(-12, Math.min(6, run.reasoning)); // dead ends drag; a clean path lifts

  // Procedure knowledge is its own axis, but only when a case actually poses quizzes — otherwise
  // it's dropped and its weight redistributes to diagnosis/repair (older cases score identically).
  const hasQ = run.knowledgeTotal > 0;
  const kNorm = hasQ ? run.knowledgeCorrect / run.knowledgeTotal : 0;
  const w = hasQ ? { dx: 0.45, rp: 0.30, k: 0.15, time: 0.10 } : { dx: 0.55, rp: 0.35, k: 0, time: 0.10 };
  const processScore = Math.max(0, Math.min(100, Math.round(100 * (w.dx * dxNorm + w.rp * rpNorm + w.k * kNorm + w.time * timeEff)) + pathAdj));
  const grade = scoreToGrade(processScore, 100);

  // ── ECONOMY · outcome gates XP, process sets the magnitude ──
  const xpEarned = fixed ? Math.round(TREE_BASE_XP * processScore / 100) : 0;

  return { kind, fixed, processScore, grade, xpEarned, decisionPts, repairWeight, repairPts, repairNote, effPts, over, knowledgeCorrect: run.knowledgeCorrect, knowledgeTotal: run.knowledgeTotal };
}

// Anti-farming. A tree's seeds are drawn at random, so replaying a case you've already solved
// is a real XP faucet — with only a couple of trees at launch, a known (tree, seed) pair could
// be farmed indefinitely. Decay is therefore keyed on the (tree, seed) PAIR, not the tree:
// meeting a genuinely new fault in a familiar case still pays full, while re-running the same
// fault halves each time — mirroring retryDecayRate in the MCQ economy.
//
// `attemptNumber` is 1 for the first-ever run of THIS tree with THIS seed.
// Must be computed server-side from attempt history; the client figure is display-only.
export function treeXpForAttempt(baseXp: number, attemptNumber: number): number {
  return Math.round(baseXp * retryDecayRate(attemptNumber));
}
