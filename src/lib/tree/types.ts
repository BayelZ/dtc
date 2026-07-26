// Local prototype types for the diagnostic-tree runner. Mirrors the pilot spec
// (proposals/tree-format/diag-tree.schema.ts). Prototype only — not shipped.
export type NodeType = "intake" | "action" | "result" | "decision" | "repair" | "outcome" | "quiz";

export interface DiagOption {
  label: string;
  targetNodeId: string;
  scoreWeight: number;
  commitsTo?: string; // decision options: the fault id this commits to (for evidence-based scoring)
  correct?: boolean;  // quiz options: marks the right answer (scored on the knowledge axis)
}

export interface DiagNode {
  id: string;
  type: NodeType;
  prompt: string;
  timeCost?: number;
  options?: DiagOption[];
  nextNodeId?: string; // non-branching link: the single successor (a node id, or RESOLVE). Not a choice.
  continueLabel?: string; // optional caption for the unscored "Continue" control on a nextNodeId node
  repairScope?: "all-revealed" | "first-revealed"; // repair nodes: fix what was revealed by testing
  repairs?: string[]; // repair nodes: explicit fault ids this repair addresses (e.g. a component swap)
  condition?: "all-faults-repaired" | "faults-remain" | "wrong-system"; // outcome nodes only
  explanation?: string; // quiz nodes: the teaching point shown after answering
}

// A fault the seed actually has, tied to the test that reveals it under load.
export interface SeedFault {
  id: string;
  label: string;
  revealedBy: string; // nodeId of the test that shows it out of spec
}

export interface FaultSeed {
  id: string;
  internalNote: string;
  activeFaults: SeedFault[]; // what's actually wrong on this run
  resultOverrides: Record<string, string>;
}

// Sentinel option target: "compute the outcome from repaired vs. actual faults".
export const RESOLVE = "#resolve";

export interface DiagChallenge {
  id: string;
  title: string;
  vehicle: { year: number; make: string; model: string; engine?: string };
  complaintTemplate: string;
  faultSeeds: FaultSeed[];
  nodes: DiagNode[];
  scoringRules: {
    decisionNodeWeight: number;
    pathEfficiencyWeight: number;
    repairSelectionWeight: number;
    timeBudgetMinutes: number;
  };
}
