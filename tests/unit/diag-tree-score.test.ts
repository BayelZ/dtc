// Locks the scoring→economy split (open item #2): the binary OUTCOME gates XP, the PROCESS
// score is graded independently. The load-bearing invariant is "a comeback is never a pass" —
// even a B-grade diagnosis pays 0 XP if the vehicle left broken.
import { scoreTree, treeXpForAttempt, TREE_BASE_XP, type ScorableRun, type ScoringRules } from "@/lib/tree/score";

const RULES: ScoringRules = { decisionNodeWeight: 5, pathEfficiencyWeight: 2, repairSelectionWeight: 3, timeBudgetMinutes: 55 };

// A run that committed on evidence and repaired fault(s), fast. Override per case.
const run = (o: Partial<ScorableRun> = {}): ScorableRun => ({
  reasoning: 8,
  decisionWeight: 6,
  repairScope: null,
  repairExplicit: ["f1"],
  resolved: { repaired: [{}], remaining: [], lucky: false },
  timeSpent: 45,
  knowledgeCorrect: 0,
  knowledgeTotal: 0,
  ...o,
});
const fixedOutcome = { condition: "all-faults-repaired" as const, nodeId: "out_good" };
const comebackOutcome = { condition: "faults-remain" as const, nodeId: "out_comeback" };
const maskedOutcome = { condition: "wrong-system" as const, nodeId: "out_masked" };

describe("tree scoring — outcome gates the economy", () => {
  it("clean diagnosis: fixed, full XP, top grade", () => {
    const s = scoreTree(run(), RULES, fixedOutcome);
    expect(s.kind).toBe("clean");
    expect(s.fixed).toBe(true);
    expect(s.grade).toBe("A");
    expect(s.xpEarned).toBe(TREE_BASE_XP); // 100/100 process → full payout
  });

  it("lucky fix: still fixed and paid, but graded below a clean diagnosis", () => {
    const s = scoreTree(
      run({ decisionWeight: 1, reasoning: 2, resolved: { repaired: [{}], remaining: [], lucky: true } }),
      RULES,
      fixedOutcome,
    );
    expect(s.kind).toBe("lucky");
    expect(s.fixed).toBe(true);
    expect(s.xpEarned).toBeGreaterThan(0);
    expect(s.xpEarned).toBeLessThan(TREE_BASE_XP); // right part, never proven → partial
    expect(s.processScore).toBeLessThan(scoreTree(run(), RULES, fixedOutcome).processScore);
  });

  it("THE INVARIANT: a good-process comeback still pays 0 XP", () => {
    // Committed on evidence to f1 and repaired it — but a second fault (f2) remained.
    const s = scoreTree(
      run({ resolved: { repaired: [{}], remaining: [{}], lucky: false } }),
      RULES,
      comebackOutcome,
    );
    expect(s.kind).toBe("comeback");
    expect(s.fixed).toBe(false);
    expect(s.xpEarned).toBe(0);           // gated to zero regardless of…
    expect(s.processScore).toBeGreaterThanOrEqual(66); // …a B-or-better process grade
    expect(["A", "B"]).toContain(s.grade);
  });

  it("masked (wrong-system): fixed nothing, 0 XP, worst outcome kind", () => {
    const s = scoreTree(
      run({ decisionWeight: -4, repairExplicit: null, resolved: null }),
      RULES,
      maskedOutcome,
    );
    expect(s.kind).toBe("masked");
    expect(s.fixed).toBe(false);
    expect(s.xpEarned).toBe(0);
  });

  it("wrong component (repaired the wrong fault): comeback, penalized repair, 0 XP", () => {
    const s = scoreTree(
      run({ decisionWeight: -3, resolved: { repaired: [], remaining: [{}], lucky: false } }),
      RULES,
      comebackOutcome,
    );
    expect(s.kind).toBe("comeback");
    expect(s.repairWeight).toBe(-2); // wrong component, not just incomplete
    expect(s.xpEarned).toBe(0);
  });

  it("procedure quizzes are a graded axis: flubbing them lowers a clean fix's grade & XP", () => {
    const aced = scoreTree(run({ knowledgeCorrect: 3, knowledgeTotal: 3 }), RULES, fixedOutcome);
    const flubbed = scoreTree(run({ knowledgeCorrect: 0, knowledgeTotal: 3 }), RULES, fixedOutcome);
    expect(aced.knowledgeTotal).toBe(3);
    expect(flubbed.processScore).toBeLessThan(aced.processScore);
    expect(flubbed.xpEarned).toBeLessThan(aced.xpEarned);
    expect(flubbed.fixed).toBe(true); // still fixed — knowledge is process, not outcome
  });

  it("cases without quizzes score exactly as before (knowledge axis omitted)", () => {
    const s = scoreTree(run(), RULES, fixedOutcome); // knowledgeTotal 0
    expect(s.knowledgeTotal).toBe(0);
    expect(s.grade).toBe("A"); // same 100 as the original clean-diagnosis case
  });

  it("is calibrated against the MCQ economy: a flawless tree out-pays a perfect fast session", () => {
    const clean = scoreTree(run(), RULES, fixedOutcome);
    // A perfect, maximally-fast 10-question MCQ session on the mean challenge (~143 xp_reward)
    // pays roughly 143 + 70 speed bonus. A flawless tree should sit above that, not below.
    expect(clean.xpEarned).toBeGreaterThan(213);
  });

  it("risk-adjusts correctly: a comeback-prone novice earns less per run than an MCQ session", () => {
    // Novice profile: commits on a hunch, repairs incompletely, leaves a fault → comeback.
    const novice = scoreTree(
      run({ decisionWeight: 1, reasoning: -4, resolved: { repaired: [{}], remaining: [{}], lucky: false } }),
      RULES,
      comebackOutcome,
    );
    expect(novice.xpEarned).toBe(0); // the gate does the work — no partial credit for a broken car
  });

  it("retry decay halves a repeat run of the same (tree, seed) pair", () => {
    expect(treeXpForAttempt(TREE_BASE_XP, 1)).toBe(TREE_BASE_XP);
    expect(treeXpForAttempt(TREE_BASE_XP, 2)).toBe(Math.round(TREE_BASE_XP / 2));
    expect(treeXpForAttempt(TREE_BASE_XP, 3)).toBe(Math.round(TREE_BASE_XP / 4));
    expect(treeXpForAttempt(200, 1)).toBe(200); // first-ever run of a new seed still pays full
  });

  it("XP scales with process score on a fixed RO", () => {
    const clean = scoreTree(run(), RULES, fixedOutcome);
    const slower = scoreTree(run({ timeSpent: 90, reasoning: -6 }), RULES, fixedOutcome);
    expect(slower.xpEarned).toBeLessThan(clean.xpEarned);
    expect(slower.fixed).toBe(true); // still fixed — just a lower-quality fix
  });
});
