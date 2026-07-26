// Guards the server-side scoring path. The load-bearing property is that the answer key
// (faultSeeds) never leaves the server, and that a client cannot forge a path to a better score.
import {
  sanitizeTreeForClient, initialRun, applyChoice, replay, withSeed, pickSeedId,
  InvalidStepError, CONTINUE, type Step,
} from "@/lib/tree/engine";
import { scoreTree } from "@/lib/tree/score";
import type { DiagChallenge } from "@/lib/tree/types";
import hgTree from "@/lib/tree/headGasket.tree.json";
import catTree from "@/lib/tree/catalystSecondOpinion.tree.json";

const HG = hgTree as DiagChallenge;
const CAT = catTree as DiagChallenge;

describe("the answer key never reaches the client", () => {
  it("sanitized tree has no faultSeeds at all", () => {
    const safe = sanitizeTreeForClient(HG) as Record<string, unknown>;
    expect("faultSeeds" in safe).toBe(false);
    expect(safe.nodes).toBeDefined();      // but the playable structure survives
    expect(safe.scoringRules).toBeDefined();
  });

  // NOTE on fault IDs: commitsTo/repairs reference fault ids, so ids like "dead_cat" DO appear
  // client-side — necessarily, and harmlessly. An id mirrors its own visible option label ("The
  // converter is dead — replace the converter") and is present for every seed alike, so it says
  // nothing about which fault is live this run. The secrets are the ACTIVE seed's identity, its
  // internal note, its fault descriptions and its readings — asserted below.
  it("no seed id, internal note, fault label or reading survives serialization", () => {
    const wire = JSON.stringify(sanitizeTreeForClient(CAT));
    for (const seed of CAT.faultSeeds) {
      expect(wire).not.toContain(seed.id);
      expect(wire).not.toContain(seed.internalNote);
      for (const f of seed.activeFaults) expect(wire).not.toContain(f.label);
      for (const reading of Object.values(seed.resultOverrides)) expect(wire).not.toContain(reading);
    }
  });

  it("a reading is released only for the node actually entered", () => {
    const tree = withSeed(CAT, "seed_cat_and_misfire");
    const step1 = applyChoice(tree, initialRun(tree), 0);  // -> q_cat_theory (a quiz: no reading)
    expect(step1.reading).toBeUndefined();
    const step2 = applyChoice(tree, step1.run, 2);         // correct answer -> act_scope_o2
    expect(step2.reading).toContain("mirrors it almost move for move");
    // The misfire evidence lives on act_fuel_trims, which was never entered — never released.
    const seed = CAT.faultSeeds.find((s) => s.id === "seed_cat_and_misfire")!;
    expect(step2.reading).not.toBe(seed.resultOverrides["act_fuel_trims"]);
  });
});

// Walk the head-gasket tree the way a tech would: pressure test (reveals the outlet housing on
// that seed), commit to it, repair, verify, release.
const cleanOutletHousingRun: Step[] = [
  { from: "intake", option: 1 },             // pressure-test the system
  { from: "q_pressure_how", option: 0 },     // correct answer
  { from: "act_pressure_test", option: 2 },  // log it and commit
  { from: "decision", option: 1 },           // it's the outlet housing
  { from: "repair_outlet", option: CONTINUE },
  { from: "verify", option: 0 },             // road-test it
  { from: "act_roadtest", option: CONTINUE },
];

describe("server-side replay reproduces a run", () => {
  it("scores a clean, evidence-backed fix as fixed + top grade", () => {
    const run = replay(withSeed(HG, "seed_outlet_housing"), cleanOutletHousingRun);
    expect(run.resolved).not.toBeNull();
    expect(run.resolved!.remaining).toHaveLength(0);
    expect(run.resolved!.lucky).toBe(false);
    expect(run.knowledgeCorrect).toBe(1);
    const s = scoreTree(run, HG.scoringRules, { condition: "all-faults-repaired", nodeId: run.nodeId });
    expect(s.kind).toBe("clean");
    expect(s.grade).toBe("A");
  });

  it("the SAME path against a different seed is a comeback — the seed decides, not the path", () => {
    const run = replay(withSeed(HG, "seed_headgasket"), cleanOutletHousingRun);
    expect(run.resolved!.remaining).toHaveLength(1);
    const s = scoreTree(run, HG.scoringRules, { condition: "faults-remain", nodeId: run.nodeId });
    expect(s.kind).toBe("comeback");
    expect(s.xpEarned).toBe(0);
  });

  it("committing without testing is scored as a hunch, not a diagnosis", () => {
    // Straight from intake to the head-gasket job — right part, zero evidence, no verification.
    const run = replay(withSeed(HG, "seed_headgasket"), [
      { from: "intake", option: 3 },
      { from: "repair_hg", option: CONTINUE },
      { from: "verify", option: 1 },
    ]);
    const lucky = scoreTree(run, HG.scoringRules, { condition: "all-faults-repaired", nodeId: run.nodeId });
    const earned = scoreTree(
      replay(withSeed(HG, "seed_outlet_housing"), cleanOutletHousingRun),
      HG.scoringRules, { condition: "all-faults-repaired", nodeId: "out_good" },
    );
    expect(lucky.kind).toBe("lucky");        // fixed the car, never proved it
    expect(lucky.grade).not.toBe("A");
    expect(lucky.xpEarned).toBeLessThan(earned.xpEarned);
  });
});

describe("a client cannot forge a path", () => {
  const tree = withSeed(HG, "seed_outlet_housing");

  it("rejects a step taken from a node the run isn't on", () => {
    expect(() => replay(tree, [{ from: "decision", option: 1 }])).toThrow(InvalidStepError);
  });

  it("rejects an option index that doesn't exist on the node", () => {
    expect(() => replay(tree, [{ from: "intake", option: 99 }])).toThrow(InvalidStepError);
  });

  it("rejects CONTINUE on a node that has no nextNodeId", () => {
    expect(() => replay(tree, [{ from: "intake", option: CONTINUE }])).toThrow(InvalidStepError);
  });

  it("rejects stepping past a finished run", () => {
    const run = replay(tree, cleanOutletHousingRun);
    expect(() => applyChoice(tree, run, 0)).toThrow(InvalidStepError);
  });

  it("refuses to score without a seed — no silent default", () => {
    expect(() => applyChoice(HG, initialRun(HG), 0)).toThrow(InvalidStepError);
  });
});

describe("seed selection", () => {
  it("only ever draws a seed the tree actually declares", () => {
    const ids = new Set(CAT.faultSeeds.map((s) => s.id));
    for (let i = 0; i < 40; i++) expect(ids.has(pickSeedId(CAT))).toBe(true);
  });
});
