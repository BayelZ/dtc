// Enforces that the four pilot trees actually satisfy the canonical diag-tree schema
// (the "source of truth" in proposals/), and that the item-3 de-fake validations bite.
// Before this test, "the schema validates all four trees" was an unverified claim —
// nothing imported the schema. Now CI holds the trees to it.
import { DiagChallengeSchema } from "../../proposals/tree-format/diag-tree.schema";
import hgTree from "@/lib/tree/headGasket.tree.json";
import noStartTree from "@/lib/tree/intermittentNoStart.tree.json";
import altTree from "@/lib/tree/alternatorNotBroken.tree.json";
import voltTree from "@/lib/tree/voltageDropNoCrank.tree.json";
import catTree from "@/lib/tree/catalystSecondOpinion.tree.json";
import shudderTree from "@/lib/tree/shudderAtFortyFive.tree.json";
import busTree from "@/lib/tree/busWentQuiet.tree.json";

const TREES: [string, unknown][] = [
  ["headGasket", hgTree],
  ["intermittentNoStart", noStartTree],
  ["alternatorNotBroken", altTree],
  ["voltageDropNoCrank", voltTree],
  ["catalystSecondOpinion", catTree],
  ["shudderAtFortyFive", shudderTree],
  ["busWentQuiet", busTree],
];

describe("diag-tree schema validates the pilot trees", () => {
  it.each(TREES)("%s parses clean", (_name, tree) => {
    const res = DiagChallengeSchema.safeParse(tree);
    if (!res.success) throw new Error(JSON.stringify(res.error.issues, null, 2));
    expect(res.success).toBe(true);
  });

  it("every non-branching link uses nextNodeId, never a single-option array", () => {
    for (const [, tree] of TREES) {
      const t = tree as { nodes: { id: string; options?: unknown[] }[] };
      for (const n of t.nodes) {
        expect(n.options?.length === 1).toBe(false); // single "option" is a linear link → nextNodeId
      }
    }
  });
});

// Minimal valid tree we mutate to prove each new rule rejects what it should.
const base = () => ({
  id: "t",
  title: "t",
  vehicle: { year: 2020, make: "X", model: "Y" },
  complaintTemplate: "c",
  faultSeeds: [
    { id: "s1", internalNote: "n", activeFaults: [{ id: "f1", label: "f", revealedBy: "act" }], resultOverrides: {} },
    { id: "s2", internalNote: "n", activeFaults: [{ id: "f2", label: "f", revealedBy: "act" }], resultOverrides: {} },
  ],
  nodes: [
    { id: "intake", type: "intake", prompt: "p", options: [
      { label: "test", targetNodeId: "act", scoreWeight: 1 },
      { label: "bad", targetNodeId: "dec", scoreWeight: -3 },
    ] },
    { id: "act", type: "action", prompt: "p", timeCost: 5, nextNodeId: "dec" },
    { id: "dec", type: "decision", prompt: "p", options: [
      { label: "commit", targetNodeId: "rep", commitsTo: "f1", scoreWeight: 6 },
      { label: "wrong", targetNodeId: "out_bad", scoreWeight: -4 },
    ] },
    { id: "rep", type: "repair", prompt: "p", timeCost: 10, repairs: ["f1"], nextNodeId: "#resolve" },
    { id: "out_good", type: "outcome", prompt: "p", condition: "all-faults-repaired" },
    { id: "out_bad", type: "outcome", prompt: "p", condition: "faults-remain" },
  ],
  scoringRules: { decisionNodeWeight: 5, pathEfficiencyWeight: 2, repairSelectionWeight: 3, timeBudgetMinutes: 30 },
});

const msgs = (v: unknown) => {
  const r = DiagChallengeSchema.safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe("de-fake validations reject fakes", () => {
  it("the base fixture is valid", () => {
    expect(DiagChallengeSchema.safeParse(base()).success).toBe(true);
  });

  it("rejects a node with both options and nextNodeId", () => {
    const t = base();
    (t.nodes[1] as Record<string, unknown>).options = [{ label: "x", targetNodeId: "dec", scoreWeight: 0 }];
    expect(msgs(t).some((m) => /branches or links, not both/.test(m))).toBe(true);
  });

  it("rejects a single-option node (should be nextNodeId)", () => {
    const t = base();
    delete (t.nodes[1] as Record<string, unknown>).nextNodeId;
    (t.nodes[1] as Record<string, unknown>).options = [{ label: "x", targetNodeId: "dec", scoreWeight: 0 }];
    expect(msgs(t).some((m) => /single option/.test(m))).toBe(true);
  });

  it("rejects commitsTo pointing at a fault no seed declares", () => {
    const t = base();
    (t.nodes[2].options![0] as Record<string, unknown>).commitsTo = "ghost";
    expect(msgs(t).some((m) => /commitsTo unknown fault/.test(m))).toBe(true);
  });

  it("rejects commitsTo that disagrees with the repair it routes to", () => {
    const t = base();
    (t.nodes[3] as Record<string, unknown>).repairs = ["f2"]; // repair fixes f2, option commits to f1
    expect(msgs(t).some((m) => /commitsTo .* but routes to repair/.test(m))).toBe(true);
  });

  it("rejects a repair addressing a fault no seed declares", () => {
    const t = base();
    (t.nodes[3] as Record<string, unknown>).repairs = ["battery_swap"];
    expect(msgs(t).some((m) => /repairs unknown fault/.test(m))).toBe(true);
  });

  it("rejects nextNodeId to a missing node", () => {
    const t = base();
    (t.nodes[1] as Record<string, unknown>).nextNodeId = "nowhere";
    expect(msgs(t).some((m) => /nextNodeId targets missing node/.test(m))).toBe(true);
  });
});
