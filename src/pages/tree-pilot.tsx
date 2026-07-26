import React, { useState } from "react";
import type { NextPage } from "next";
import { TreeRunner } from "@/components/tree/TreeRunner";
import type { DiagChallenge } from "@/lib/tree/types";
import altTree from "@/lib/tree/alternatorNotBroken.tree.json";
import voltTree from "@/lib/tree/voltageDropNoCrank.tree.json";
import hgTree from "@/lib/tree/headGasket.tree.json";
import noStartTree from "@/lib/tree/intermittentNoStart.tree.json";
import catTree from "@/lib/tree/catalystSecondOpinion.tree.json";
import shudderTree from "@/lib/tree/shudderAtFortyFive.tree.json";
import busTree from "@/lib/tree/busWentQuiet.tree.json";

// DEV-ONLY prototype page for the diagnostic-tree pilot. Not linked in nav, not
// wired to Supabase/auth. Visit /tree-pilot locally to feel the interaction.
// Beta candidates (native-authored, quiz-interleaved) first, then the earlier pilots.
const CASES: { key: string; label: string; tree: DiagChallenge; beta?: boolean }[] = [
  { key: "hg", label: "Everyone Said Head Gasket", tree: hgTree as DiagChallenge, beta: true },
  { key: "cat", label: "The Cat That Wasn't Dead", tree: catTree as DiagChallenge, beta: true },
  { key: "shudder", label: "The Shudder at 45", tree: shudderTree as DiagChallenge, beta: true },
  { key: "bus", label: "The Bus That Went Quiet", tree: busTree as DiagChallenge, beta: true },
  { key: "nostart", label: "No-Start That Starts Fine for You", tree: noStartTree as DiagChallenge },
  { key: "alt", label: "The Alternator That Wasn't Broken", tree: altTree as DiagChallenge },
  { key: "volt", label: "Voltage Drop — Starter No-Crank", tree: voltTree as DiagChallenge },
];

const TreePilot: NextPage = () => {
  const [caseKey, setCaseKey] = useState("hg");
  const active = CASES.find((c) => c.key === caseKey) ?? CASES[0];
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-sans)", padding: "18px 16px 64px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto 16px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--text-faint)", fontWeight: 600 }}>Case</span>
        {CASES.map((c) => (
          <button key={c.key} onClick={() => setCaseKey(c.key)}
            style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
              background: c.key === caseKey ? "var(--accent-tint)" : "var(--bg-card)", color: c.key === caseKey ? "var(--accent-hi)" : "var(--text-muted)",
              border: `0.5px solid ${c.key === caseKey ? "var(--accent)" : "var(--border)"}` }}>{c.label}</button>
        ))}
      </div>
      <TreeRunner key={caseKey} challenge={active.tree} />
    </div>
  );
};

export default TreePilot;
