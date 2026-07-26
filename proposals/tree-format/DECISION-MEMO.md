# Decision Memo — Diagnostic-Tree Challenges

**Date:** 2026-07-22 · **Status:** for decision · **Author:** DTC dev
**TL;DR:** The tree format works and serves the mission better than MCQ on both axes (AI-resistance, skill signal). The friction we hit converting existing cases is not a format problem — it's that the whole bank was authored as multiple-choice. **Recommendation: author native tree cases from the ground up; treat conversion as the exception. Fund one SME-driven flagship, playtest it with real techs, then decide on a tier.**

---

## 1. What we built (reference)

Two working prototypes, a self-contained runner, and a proposed schema + storage:
- `voltage-drop-no-crank.tree.json` — a procedure case (deliberately simple, exposed the format's floor).
- `smart-charge-bms.tree.json` — "The Alternator That Wasn't Broken." The real test: competing hypotheses, an expert trap, three seeds where the *same* commitment is right once and wrong twice, and one seed whose correct answer is *replace nothing*.
- `diag-tree.schema.ts` — Zod schema (validated).
- `028_diag_trees_pilot.PROPOSED.sql` — a new `challenge_trees` table (not applied).
- `SEED-AWARE-OUTCOMES.sketch.md` — outcomes computed against the real fault, not hardcoded.
- Local runner at `/tree-pilot` (dev-only, not shipped): bench log, time budget, seed-aware scoring.

## 2. The core finding: convert vs. author native

Every rough edge we fought — decision options that read as a vague "fix what I found," readouts that gave away the diagnosis, outcomes that didn't fit the path, seeds bolted on afterward — has one root cause:

> **MCQ cases have no decision topology to convert.** An MCQ is a linear sequence of question → four options → one keyed answer, with the reasoning *stated in the option text*. A tree needs the opposite: competing hypotheses, tests whose **order** matters, a fault that stays hidden until the tech acts, and a moment of commitment scored by the **evidence gathered**, not the label chosen.

Converting an MCQ means reverse-engineering topology that was never designed in. It half-works for cases that happen to contain a real fork (misdiagnosis / comeback cases), and fights us everywhere else.

**Decision:** author tree cases **native**. Convert only when a case already has genuine forks, and even then, re-author — don't adapt.

## 3. What a native tree case needs (that an MCQ never had)

1. **A ground-truth fault model as data** — faults with `id`, the test that `revealedBy`s them, and how they're `repaired`. Not prose. This is what makes outcomes computable and seeds cheap.
2. **2+ seeds sharing one tree shape** — same shell, different culprit. The correct *reasoning* is seed-invariant; the *answer* is not. Include at least one seed where the obvious part-swap is **wrong**, and ideally one where the answer is **"replace nothing."**
3. **Tests that reveal faults, order-dependent, time-costed** against real book time.
4. **At least one real, recoverable dead end** — a plausible misleading lead that costs time and returns to the bench.
5. **A decision node that commits to a *specific* root cause** — scored by whether the tech ran the test that supports it (evidence), not by picking the right label.
6. **Evidence-only readouts** — findings, never the verdict.
7. **Seed-aware outcomes** — earned against the real fault: fixed / comeback / "lucky" (right part, no diagnosis) / masked.

## 4. Authoring rules (the gates for this format)

Hold every tree case to these before it ships — the same spirit as the MCQ content gates already in `CLAUDE.md`:

1. **Readouts state evidence, never the diagnosis or the fix.** Banned: "…and that's what's causing it." Give numbers, corrosion, a reading against spec — let the tech conclude. *(This was the sharpest defect we found in review.)*
2. **Name components concretely and consistently, introduced on first mention.** No mystery "the sensor." (e.g., "the battery current sensor clamped on the negative battery cable.")
3. **Every option is a plausible same-system move.** No throwaways, no cross-system absurdities — carry over the migration-019 distractor standard. The correct action must not be the longest or most-detailed option.
4. **The decision is a specific commitment, not "fix what I found."** Score it by evidence gathered. Committing to a fault you never tested = a hunch (lucky if right, comeback if wrong), not a win.
5. **At least one recoverable dead end** (the misleading lead). The tech eats the time and continues; it never ends the run.
6. **Ground truth lives in data**, never hand-written per branch. If you're writing a different "it came back" sentence for each path, you're doing it wrong — compute it from repaired-vs-actual.
7. **Time-cost every action against real book time.** Flag any guess inline as a `council-of-elders` TODO — do not ship estimates as fact. *(The alternator R&R time in the pilot is exactly such a placeholder.)*
8. **AI-resistance is structural, not cosmetic.** The case must not be solvable from the intake text alone. The discriminating data appears only after the tech acts. Seeds must make answer-sharing between attempts worthless.
9. **Distribution checks still apply** — across a batch of tree cases, the correct root cause and the "right first move" must not cluster on one archetype (don't let "it's always a ground" become the new "pick C").

## 5. Where it fits (and the honest cost)

- A good native tree with seeds is **~5–10× the authoring cost of a 10-question MCQ set**, plus SME time for fault realism and book times. **This is not a catalog rewrite.**
- Right home: a **small premium tier** — a weekly flagship "Case of the Week" / capstones, and the **Daily Case at 2× XP** (plumbing already exists: `DAILY_XP_MULTIPLIER` / `isDaily`). Keep MCQ for breadth and drilling.
- It is the strongest thing we have for the mission: it can't be one-shotted by an LLM, and it measures reasoning (order, evidence, when *not* to replace a part) that MCQ physically cannot.

## 6. Open questions to close before a v1 build

- **Schema:** add `nextNodeId` for clean non-branching links; formalize the resolver + `commitsTo` scoring that the prototype fakes.
- **Scoring → economy:** separate the binary outcome (fixed / comeback) from the process score, and decide how each feeds the finite-XP economy and the leaderboard. A comeback should never read as a pass, regardless of process points.
- **Storage:** apply the proposed `challenge_trees` table (isolated; drops cleanly if the pilot ends). RLS on a new table is flagged for review.
- **Runner:** the `/tree-pilot` React is throwaway. A shippable runner is real work.
- **Anti-AI, top tier:** consider free-text "name your next test" instead of options for capstones (raises grading complexity).
- **Authoring tooling:** SMEs will not hand-write JSON reliably. Needs an authoring aid or an ironclad template, or we get exactly one tree forever.

## 7. Recommendation & next action

1. Adopt **native-first** authoring and the §4 rules as the standard for this format.
2. **Fund one native flagship, authored from the ground up with a council-of-elders SME on the scenario** (fault realism + book times). Don't let dev invent the technical content — that reproduces the very problem the mission exists to fight.
3. **Playtest it with real techs** to judge *engagement*, not just correctness — the one thing the prototypes can't tell us.
4. Decide the tier (Case of the Week / Daily 2× XP) from that data.

Dev can build the shell, runner, schema, and scoring. The gating input is a **real diagnostic scenario from an SME** to author against — that's the next thing to line up.

---

### Appendix — reference prototype set

Four playable cases (dev page `/tree-pilot`, case switcher). Each was chosen to exercise a
different facet of the format; together they're the reference for what "good" looks like.

| Case | File (tree JSON) | Demonstrates |
|---|---|---|
| **Everyone Said Head Gasket** | `cooling-second-opinion` | The universal trap + huge cost asymmetry. Seeds: real head gasket (right answer, but only via block test) / cheap external leak / **"no parts — last shop left air in it."** Teaches *confirm the expensive job before you sell it.* |
| **The No-Start That Starts Fine for You** | `intermittent-no-start` | Instrumenting a failure you can't reproduce. One capture rig reveals whichever seed's fault (crank sensor / fuel pump / immobilizer); chasing it in the bay is the dead end. Most AI-resistant of the set. |
| **The Alternator That Wasn't Broken** | `smart-charge-bms` | "Normal vs. fault" + when *not* to replace a part. Seeds where the same "replace the alternator" is wrong twice, right once; one seed's answer is "register the battery, replace nothing." |
| **Voltage Drop — Starter No-Crank** | `voltage-drop-no-crank` | The format's *floor* — a procedure case. Kept as the contrast that proves the format only pays off with real decision topology. |

**Engine / support files (prototype — throwaway UI, not shipped):**
- Schema (source of truth): `proposals/tree-format/diag-tree.schema.ts` (Zod). All four trees validate.
- Runner: `src/components/tree/TreeRunner.tsx`, types `src/lib/tree/types.ts`, dev page `src/pages/tree-pilot.tsx`, tree JSON copies in `src/lib/tree/`.
- Proposed storage: `028_diag_trees_pilot.PROPOSED.sql` (new `challenge_trees` JSONB table — **not applied**).
- Design notes: `SEED-AWARE-OUTCOMES.sketch.md`, and `HANDOFF.md` (pick-up guide for the next session).

Nothing is committed to production; no migration applied. `/tree-pilot` is dev-only, unrouted in nav, and needs no Supabase.
