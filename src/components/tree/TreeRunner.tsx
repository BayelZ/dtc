import React, { useMemo, useState } from "react";
import type { DiagChallenge, DiagNode, DiagOption, FaultSeed, SeedFault } from "@/lib/tree/types";
import { RESOLVE } from "@/lib/tree/types";
import { gradeLabel, gradeColor } from "@/lib/utils";
import { scoreTree, type OutcomeKind } from "@/lib/tree/score";

// Local prototype tree-runner. Self-contained (no Supabase/auth) so it runs in the
// dev preview. Now SEED-AWARE: the ending is computed from what the tech actually
// repaired vs. the fault this seed really has — and you can only repair a fault you
// revealed by running the test that shows it.

interface LogEntry { kind: "did" | "found" | "quiz-ok" | "quiz-bad"; text: string; time?: number; }

interface RunState {
  nodeId: string;
  timeSpent: number;
  log: LogEntry[];
  visited: string[];                    // node ids entered — used to know which tests revealed which faults
  reasoning: number;
  decisionWeight: number | null;
  repairScope: "all-revealed" | "first-revealed" | null;
  repairExplicit: string[] | null;      // explicit fault ids a component swap addresses
  resolved: { repaired: SeedFault[]; remaining: SeedFault[]; lucky: boolean } | null;
  knowledgeCorrect: number;             // interleaved procedure-quiz answers gotten right
  knowledgeTotal: number;               // quizzes answered this run
}

const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

function randomSeedId(seeds: FaultSeed[]): string {
  return seeds[Math.floor(Math.random() * seeds.length)].id;
}

// Score a decision commitment by the evidence behind it:
//   committed to a fault you tested for and that's real  -> full credit (diagnosed)
//   committed to a real fault you never tested for       -> minimal (a right hunch)
//   committed to a fault that isn't present              -> penalty (wrong hypothesis)
// Options without commitsTo (pure distractors) keep their static weight.
function commitScore(seed: FaultSeed, opt: DiagOption, visited: string[]): number {
  if (!opt.commitsTo) return opt.scoreWeight;
  const fault = seed.activeFaults.find((f) => f.id === opt.commitsTo);
  if (!fault) return -3;
  return visited.includes(fault.revealedBy) ? 6 : 1;
}

// faults revealed, in the order the tech ran the tests that show them
function revealedInOrder(seed: FaultSeed, visited: string[]): SeedFault[] {
  const out: SeedFault[] = [];
  for (const v of visited) {
    const f = seed.activeFaults.find((p) => p.revealedBy === v && !out.includes(p));
    if (f) out.push(f);
  }
  return out;
}

export const TreeRunner: React.FC<{ challenge: DiagChallenge }> = ({ challenge }) => {
  const byId = useMemo(() => Object.fromEntries(challenge.nodes.map((n) => [n.id, n])), [challenge]);
  // Store a concrete seed id (never random-in-render) so the active seed is stable and the
  // dev seed-picker highlight always matches the readings, even under StrictMode double-render.
  const [seedId, setSeedId] = useState<string>(() => randomSeedId(challenge.faultSeeds));
  const [showKey, setShowKey] = useState(false);
  const seed = useMemo(() => challenge.faultSeeds.find((s) => s.id === seedId) ?? challenge.faultSeeds[0], [challenge, seedId]);

  const startNode = challenge.nodes.find((n) => n.type === "intake") ?? challenge.nodes[0];
  const initial: RunState = { nodeId: startNode.id, timeSpent: 0, log: [], visited: [], reasoning: 0, decisionWeight: null, repairScope: null, repairExplicit: null, resolved: null, knowledgeCorrect: 0, knowledgeTotal: 0 };
  const [run, setRun] = useState<RunState>(initial);

  const node = byId[run.nodeId] as DiagNode;
  const reading = seed.resultOverrides[node.id];

  const reset = (opts?: { newSeed?: boolean }) => {
    if (opts?.newSeed) setSeedId(randomSeedId(challenge.faultSeeds));
    setRun(initial);
  };

  // Dev-only: force a specific fault seed and restart, so each economy outcome is reproducible.
  const forceSeed = (id: string) => { setSeedId(id); setRun(initial); };

  const choose = (from: DiagNode, opt: DiagOption) => {
    setRun((r) => {
      // A quiz answer is logged as a knowledge check (✓/✗ + the teaching point), not a plain step.
      const isQuiz = from.type === "quiz";
      const quizEntry: LogEntry = isQuiz
        ? { kind: opt.correct ? "quiz-ok" : "quiz-bad", text: opt.correct ? opt.label : `${opt.label}${from.explanation ? ` — ${from.explanation}` : ""}` }
        : { kind: "did", text: opt.label };
      const log = [...r.log, quizEntry];
      const knowledgeTotal = r.knowledgeTotal + (isQuiz ? 1 : 0);
      const knowledgeCorrect = r.knowledgeCorrect + (isQuiz && opt.correct ? 1 : 0);

      // Resolver: compute the outcome from repaired vs. the seed's real faults.
      if (opt.targetNodeId === RESOLVE) {
        const revealed = revealedInOrder(seed, r.visited);
        const scopeR = r.repairScope === "all-revealed" ? revealed : r.repairScope === "first-revealed" ? revealed.slice(0, 1) : [];
        const explicitR = seed.activeFaults.filter((f) => (r.repairExplicit ?? []).includes(f.id));
        const repaired = Array.from(new Set([...scopeR, ...explicitR]));
        const remaining = seed.activeFaults.filter((p) => !repaired.includes(p));
        // fixed a component without ever running the test that reveals it = lucky, not diagnosed
        const lucky = explicitR.some((f) => !revealed.includes(f));
        const cond = remaining.length === 0 ? "all-faults-repaired" : "faults-remain";
        const out = challenge.nodes.find((n) => n.type === "outcome" && n.condition === cond) ?? challenge.nodes.find((n) => n.type === "outcome")!;
        return { ...r, nodeId: out.id, log, resolved: { repaired, remaining, lucky } };
      }

      const target = byId[opt.targetNodeId];
      const enterTime = target.timeCost ?? 0;
      const found = seed.resultOverrides[target.id];
      if (enterTime > 0) log.push({ kind: "did", text: `— ${prettyAction(target)}`, time: enterTime });
      if (found) log.push({ kind: "found", text: found });
      return {
        nodeId: target.id,
        timeSpent: r.timeSpent + enterTime,
        log,
        visited: [...r.visited, target.id],
        reasoning: from.type === "intake" || from.type === "action" ? r.reasoning + opt.scoreWeight : r.reasoning,
        decisionWeight: from.type === "decision" ? commitScore(seed, opt, r.visited) : r.decisionWeight,
        repairScope: target.repairScope ?? r.repairScope,
        repairExplicit: target.repairs ?? r.repairExplicit,
        resolved: r.resolved,
        knowledgeCorrect,
        knowledgeTotal,
      };
    });
  };

  // Follow a non-branching link. Reuses the choose() machinery (incl. the resolver) via a
  // synthetic, unscored option so linear steps never count as diagnostic choices.
  const advance = (from: DiagNode) => {
    if (!from.nextNodeId) return;
    choose(from, { label: from.continueLabel ?? "Continue", targetNodeId: from.nextNodeId, scoreWeight: 0 });
  };

  const isOutcome = node.type === "outcome";
  const isQuiz = node.type === "quiz";

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>
      {/* Main column */}
      <div>
        <div style={{ background: "var(--bg-card)", border: "0.5px solid var(--border)", borderRadius: 10, padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--accent)", fontWeight: 600 }}>Repair Order · Diagnostic Tree (pilot)</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: "6px 0 2px", color: "var(--text)" }}>{challenge.title}</h1>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: MONO }}>
            {challenge.vehicle.year} {challenge.vehicle.make} {challenge.vehicle.model}{challenge.vehicle.engine ? ` · ${challenge.vehicle.engine}` : ""}
          </div>
          <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "10px 0 0", lineHeight: 1.55 }}>{challenge.complaintTemplate}</p>
        </div>

        {!isOutcome ? (
          <div style={{ background: "var(--bg-card)", border: `0.5px solid ${isQuiz ? "var(--info)" : "var(--border)"}`, borderLeft: isQuiz ? "3px solid var(--info)" : undefined, borderRadius: 10, padding: "16px 18px" }}>
            {reading && (
              <div style={{ background: "var(--bg-raised)", border: "0.5px solid var(--border)", borderLeft: "2px solid var(--accent)", borderRadius: 6, padding: "10px 12px", marginBottom: 14, fontFamily: MONO, fontSize: 12.5, color: "var(--text)", lineHeight: 1.5 }}>
                <span style={{ color: "var(--text-muted)" }}>READOUT · </span>{reading}
              </div>
            )}
            {isQuiz && (
              <div style={{ fontSize: 10.5, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--info)", fontWeight: 700, marginBottom: 9 }}>
                ◎ Knowledge check<span style={{ color: "var(--text-faint)", letterSpacing: 0, textTransform: "none", fontWeight: 500 }}> · scored on know-how, not the fix</span>
              </div>
            )}
            <p style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", margin: "0 0 14px", lineHeight: 1.5 }}>{node.prompt}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(node.options ?? []).map((o, i) => {
                const target = o.targetNodeId === RESOLVE ? null : byId[o.targetNodeId];
                const t = target?.timeCost ?? 0;
                return (
                  <button key={i} onClick={() => choose(node, o)}
                    style={{ textAlign: "left", padding: "11px 13px", borderRadius: 7, cursor: "pointer",
                      background: "var(--bg-raised)", color: "var(--text)", border: "0.5px solid var(--border)",
                      fontSize: 13.5, lineHeight: 1.45, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    {isQuiz
                      ? <span style={{ display: "flex", gap: 9 }}><span style={{ fontFamily: MONO, color: "var(--info)", fontWeight: 700 }}>{String.fromCharCode(65 + i)}</span><span>{o.label}</span></span>
                      : <span>{o.label}</span>}
                    {!isQuiz && t > 0 && <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-faint)", whiteSpace: "nowrap" }}>~{t}m</span>}
                  </button>
                );
              })}
              {/* non-branching link: one unscored Continue, not a choice */}
              {node.nextNodeId && (
                <button onClick={() => advance(node)}
                  style={{ textAlign: "left", padding: "11px 13px", borderRadius: 7, cursor: "pointer",
                    background: "transparent", color: "var(--text-muted)", border: "0.5px dashed var(--border)",
                    fontSize: 13.5, lineHeight: 1.45 }}>
                  {node.continueLabel ?? "Continue →"}
                </button>
              )}
            </div>
          </div>
        ) : (
          <OutcomeCard challenge={challenge} node={node} run={run} seed={seed} onRestart={() => reset()} onNew={() => reset({ newSeed: true })} />
        )}
      </div>

      {/* Side rail */}
      <div style={{ position: "sticky", top: 12 }}>
        <div style={{ background: "var(--bg-card)", border: "0.5px solid var(--border)", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <span style={{ fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--text-faint)", fontWeight: 600 }}>Time on the job</span>
            <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: run.timeSpent > challenge.scoringRules.timeBudgetMinutes ? "var(--bad)" : "var(--text)" }}>{run.timeSpent}m / {challenge.scoringRules.timeBudgetMinutes}m</span>
          </div>
          <div style={{ height: 5, background: "var(--bg-raised)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: 5, width: `${Math.min(100, (run.timeSpent / challenge.scoringRules.timeBudgetMinutes) * 100)}%`, background: run.timeSpent > challenge.scoringRules.timeBudgetMinutes ? "var(--bad)" : "var(--accent)" }} />
          </div>
        </div>

        <div style={{ background: "var(--bg-card)", border: "0.5px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--text-faint)", fontWeight: 600, marginBottom: 8 }}>Bench log</div>
          {run.log.length === 0 && <p style={{ fontSize: 12, color: "var(--text-faint)", margin: 0 }}>Nothing done yet.</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {run.log.map((e, i) => {
              const isQ = e.kind === "quiz-ok" || e.kind === "quiz-bad";
              const accent = e.kind === "quiz-ok" ? "var(--good)" : e.kind === "quiz-bad" ? "var(--bad)" : "var(--accent)";
              return (
                <div key={i} style={{ fontSize: 12, lineHeight: 1.45,
                  color: e.kind === "found" ? "var(--text)" : e.kind === "quiz-bad" ? "var(--text)" : "var(--text-muted)",
                  fontFamily: e.kind === "found" ? MONO : undefined,
                  paddingLeft: e.kind === "found" || isQ ? 8 : 0,
                  borderLeft: e.kind === "found" || isQ ? `2px solid ${accent}` : "none" }}>
                  {isQ && <span style={{ color: accent, fontWeight: 700 }}>{e.kind === "quiz-ok" ? "✓ " : "✗ "}</span>}
                  {e.kind === "found" ? e.text : <>{e.text}{e.time ? <span style={{ color: "var(--text-faint)" }}> ({e.time}m)</span> : null}</>}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          <button onClick={() => reset({ newSeed: true })} style={devBtn}>↻ New case (reroll fault)</button>
          <button onClick={() => reset()} style={devBtn}>↺ Restart this case</button>
          <button onClick={() => setShowKey((s) => !s)} style={devBtn}>{showKey ? "Hide" : "Reveal"} answer key (dev)</button>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
            <span style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-faint)", fontWeight: 600, width: "100%" }}>Force seed (dev)</span>
            {challenge.faultSeeds.map((s) => (
              <button key={s.id} onClick={() => forceSeed(s.id)}
                style={{ fontSize: 11, padding: "4px 8px", borderRadius: 5, cursor: "pointer", fontFamily: MONO,
                  background: seed.id === s.id ? "var(--accent-tint)" : "transparent", color: seed.id === s.id ? "var(--accent-hi)" : "var(--text-muted)",
                  border: `0.5px solid ${seed.id === s.id ? "var(--accent)" : "var(--border)"}` }}>{s.id.replace(/^seed_/, "")}</button>
            ))}
          </div>
          {showKey && (
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5, background: "var(--bg-card)", border: "0.5px dashed var(--border)", borderRadius: 8, padding: "10px 12px" }}>
              <b style={{ color: "var(--text)" }}>seed: {seed.id}</b><br />
              <span style={{ color: "var(--text-faint)" }}>faults: </span>{seed.activeFaults.map((f) => f.label).join("; ")}<br />
              {seed.internalNote}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const devBtn: React.CSSProperties = { textAlign: "left", padding: "7px 11px", borderRadius: 6, cursor: "pointer", background: "transparent", color: "var(--text-muted)", border: "0.5px solid var(--border)", fontSize: 12 };

function prettyAction(n: DiagNode): string {
  return n.prompt.split(/[.,]/)[0].replace(/^You /, "").trim();
}

const OutcomeCard: React.FC<{ challenge: DiagChallenge; node: DiagNode; run: RunState; seed: FaultSeed; onRestart: () => void; onNew: () => void }> = ({ challenge, node, run, seed, onRestart, onNew }) => {
  const rules = challenge.scoringRules;
  const good = node.condition ? node.condition === "all-faults-repaired" : node.id === "out_good";
  const res = run.resolved;

  // Seed-aware body text, computed from what was actually repaired vs. left, on top of
  // the outcome node's own (case-specific) prompt.
  let body: string;
  if (res && good) {
    body = `${node.prompt} Repaired: ${res.repaired.map((f) => f.label).join(", ") || "—"}.`;
    if (res.lucky) body += " But you swapped the part without ever running the test that proves it — a lucky fix, not a diagnosis.";
  } else if (res && !good) {
    const neverTested = res.remaining.filter((f) => !run.visited.includes(f.revealedBy));
    body = `${node.prompt} Left unaddressed: ${res.remaining.map((f) => f.label).join(", ")}.`;
    if (neverTested.length) body += ` You never ran the test that would've shown ${neverTested.length > 1 ? "them" : "it"}.`;
  } else {
    body = seed.resultOverrides[node.id] ?? node.prompt;
  }

  // Both axes (outcome gate + process grade) and the XP payout come from one pure function.
  const { kind, fixed, processScore, grade, xpEarned, decisionPts, repairPts, repairNote, effPts, over, knowledgeCorrect, knowledgeTotal } =
    scoreTree(run, rules, { condition: node.condition, nodeId: node.id });

  const line = (label: string, val: number, note?: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "0.5px solid var(--border)" }}>
      <span style={{ color: "var(--text-muted)" }}>{label}{note ? <span style={{ color: "var(--text-faint)" }}> · {note}</span> : null}</span>
      <span style={{ fontFamily: MONO, fontWeight: 700, color: val > 0 ? "var(--good)" : val < 0 ? "var(--bad)" : "var(--text-muted)" }}>{val > 0 ? "+" : ""}{val}</span>
    </div>
  );

  const OUTCOME: Record<typeof kind, { tag: string; headline: string; good: boolean }> = {
    clean: { tag: "Fixed right", headline: "Clean diagnosis", good: true },
    lucky: { tag: "Fixed — got lucky", headline: "Fixed, but never proven", good: true },
    comeback: { tag: "Comeback", headline: "Back to the Rework Bench", good: false },
    masked: { tag: "Masked — comes back worse", headline: "You blindfolded it, didn't fix it", good: false },
  };
  const oc = OUTCOME[kind];

  return (
    <div style={{ background: "var(--bg-card)", border: `0.5px solid ${oc.good ? "var(--good-border)" : "var(--bad-border)"}`, borderRadius: 10, overflow: "hidden" }}>
      {/* ── RESULT · the outcome and what it pays (economy) ── */}
      <div style={{ padding: "14px 18px", background: oc.good ? "var(--good-bg)" : "var(--bad-bg)", borderBottom: `0.5px solid ${oc.good ? "var(--good-border)" : "var(--bad-border)"}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: oc.good ? "var(--good)" : "var(--bad)", fontWeight: 700 }}>{oc.tag}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text)", marginTop: 3 }}>{oc.headline}</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 800, lineHeight: 1, color: fixed ? "var(--good)" : "var(--bad)" }}>{fixed ? `+${xpEarned}` : "0"}<span style={{ fontSize: 13, fontWeight: 700 }}> XP</span></div>
            <div style={{ fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-faint)", fontWeight: 600, marginTop: 2 }}>{fixed ? "Clean RO · streak intact" : "Rework Bench +1 · 0 XP by design"}</div>
          </div>
        </div>
        <p style={{ fontSize: 14, color: "var(--text)", margin: "10px 0 0", lineHeight: 1.5 }}>{body}</p>
      </div>

      {/* ── PROCESS REPORT · how clean the reasoning was — graded regardless of outcome ── */}
      <div style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--text-faint)", fontWeight: 600 }}>Process report</span>
          <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: MONO, fontSize: 12, color: "var(--text-faint)" }}>{processScore}/100</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: gradeColor(grade) }}>{grade}</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{gradeLabel(grade)}</span>
          </span>
        </div>
        {line("Diagnostic choices", run.reasoning)}
        {line("Root-cause commit", decisionPts, run.decisionWeight === null ? "never committed" : `×${rules.decisionNodeWeight} weight`)}
        {line("Repair selection", repairPts, repairNote)}
        {knowledgeTotal > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "0.5px solid var(--border)" }}>
            <span style={{ color: "var(--text-muted)" }}>Procedure knowledge<span style={{ color: "var(--text-faint)" }}> · interleaved checks</span></span>
            <span style={{ fontFamily: MONO, fontWeight: 700, color: knowledgeCorrect === knowledgeTotal ? "var(--good)" : knowledgeCorrect === 0 ? "var(--bad)" : "var(--text)" }}>{knowledgeCorrect}/{knowledgeTotal}</span>
          </div>
        )}
        {line("Time efficiency", effPts, over > 0 ? `${over}m over budget` : `${-over}m under`)}
        <p style={{ fontSize: 11.5, color: "var(--text-faint)", margin: "10px 0 0", lineHeight: 1.5 }}>
          {fixed
            ? "The grade sets how much a fixed RO pays. A flawless, evidence-proven fix pays full XP."
            : "Your work is still graded — but a comeback pays no XP. You diagnosed part of it; the vehicle still left broken."}
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={onNew} style={{ flex: 1, padding: "10px", borderRadius: 7, cursor: "pointer", background: "var(--accent)", color: "var(--accent-contrast)", border: "none", fontSize: 13, fontWeight: 600 }}>New case (reroll fault)</button>
          <button onClick={onRestart} style={{ flex: 1, padding: "10px", borderRadius: 7, cursor: "pointer", background: "var(--bg-raised)", color: "var(--text)", border: "0.5px solid var(--border)", fontSize: 13, fontWeight: 500 }}>Retry same fault</button>
        </div>
      </div>
    </div>
  );
};
