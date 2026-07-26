# Tree-Format Quizzes — Session Handoff

Pick-up guide for continuing the interactive diagnostic-tree challenge work. Read the
`DECISION-MEMO.md` first (the why + authoring rules), then this (the how + state).
Snapshot doc — update or delete when stale.

## What this is
An alternative to DTC's multiple-choice bank: a **branching diagnostic case** where the "case"
doesn't exist as pasteable text until the tech makes choices (AI-resistance), and scoring
measures the **reasoning path** — which tests, in what order, the evidence behind the final
commitment, time spent — not just the final answer. **Decision already made: author native, do
NOT convert MCQ cases** (see memo §2).

## Current state (all local, NOTHING committed, no migration applied)
- **Four playable prototypes** at `/tree-pilot` (dev page, case switcher, no Supabase/auth):
  head gasket, intermittent no-start, alternator, voltage-drop. See memo appendix for what each shows.
- **Runner** works end-to-end: bench log, time budget, seed-aware outcomes, evidence-based scoring.
- **Zod schema** validates all four trees. **Type-check + tests pass.**
- Proposed storage migration drafted (`028_diag_trees_pilot.PROPOSED.sql`), **not applied**.

## Files
- `proposals/tree-format/` — `DECISION-MEMO.md`, `diag-tree.schema.ts` (schema = source of truth),
  `SEED-AWARE-OUTCOMES.sketch.md`, `028_diag_trees_pilot.PROPOSED.sql`, and the 4 `*.tree.json` canonical copies.
- Prototype runner: `src/lib/tree/types.ts`, `src/lib/tree/*.tree.json` (copies the page imports),
  `src/components/tree/TreeRunner.tsx`, `src/pages/tree-pilot.tsx`.
- Note: tree JSONs are **duplicated** in `proposals/` (canonical) and `src/lib/tree/` (what runs).
  Keep them in sync when editing (a `cp` after each change), or refactor to one location next time.

## The engine model (so you can author without re-deriving)
A tree JSON is a `DiagChallenge`: `vehicle`, `complaintTemplate`, `faultSeeds[]`, `nodes[]`, `scoringRules`.
- **Node types:** `intake` / `action` / `decision` (branch, have `options`); `repair` / `outcome` (terminal-ish).
- **Fault model in data:** each seed lists `activeFaults[]` = `{id, label, revealedBy}` (the test node that reveals it).
- **Repairs:** a repair node uses either `repairScope: "all-revealed"|"first-revealed"` (fixes what testing revealed)
  or `repairs: [faultId]` (explicit component swap — fixes that fault whether or not it was tested).
- **Decision options** carry `commitsTo: faultId`. Repair options target the sentinel `"#resolve"`.
- **Seed-specific text:** `resultOverrides[nodeId]` per seed (readings, per-seed outcome flavor).
- **The resolver** (in `TreeRunner`) computes the outcome from repaired-vs-actual faults, picks the
  `outcome` node by `condition` (`all-faults-repaired` / `faults-remain` / `wrong-system`), and flags a
  **"lucky" fix** (right part, never diagnosed).
- **Scoring:** decision credit is evidence-based via `commitScore()` — committed to a fault you tested for
  and that's real → full; a real fault you never tested → minimal (hunch/lucky); a fault that isn't present → penalty.
  Plus `decisionNodeWeight` (highest) / `repairSelectionWeight` / `pathEfficiencyWeight` / `timeBudgetMinutes`.

## Authoring rules (enforce these — full list in memo §4)
Readouts state **evidence, never the verdict**. Name components concretely on first mention. Decision options are
**specific commitments, never claims about a test result** that might be false ("It's an external leak — repair it,"
NOT "Pressure test found a leak"). Distractor options/tests are intentional (you rule them out); showing only the
true cause gives away the answer. At least one recoverable dead end. Ground truth lives in data, never hand-written
per branch. **Time budget = diagnostic time, not repair labor** (or an 8-hr head-gasket swamps efficiency; put the
cost of a wrong big repair in the outcome narrative). Book-times are placeholders — flag `council-of-elders`.

## Picking the next scenario (selection criteria)
A scenario earns the tree format if it has most of: competing hypotheses; a discriminating test where order matters;
a misleading lead/trap; cost asymmetry (wrong path costs real money); 3-4 seed-able faults incl. a "no parts" and a
"the expensive fix is right but only by proof" seed; **unsolvable from the intake alone**; a real verification step;
bounded to one bay session; a hook + a transferable principle. If it's a single obvious cause or a pure procedure,
keep it MCQ.

## Gotchas (cost time this session)
- The embedded preview **viewport intermittently shrinks** after deep interaction — `preview_resize` to a fixed
  width (e.g. 1100×840) before screenshotting outcome screens.
- Seeds are **random per run**; there's no seed picker. To test a specific seed, use "Reveal answer key (dev)" +
  reroll "New case" until it lands (RNG can take several). *Consider adding a dev seed-picker next session.*
- React batches state — in `preview_eval`, click **one** button per eval (let it re-render between).

## Open items / next steps (priority order)
1. **Fund one SME-authored native flagship** + playtest with real techs for *engagement* (the one thing prototypes
   can't tell us). Dev builds the shell; the SME supplies the real scenario/specs/book-times. ← the gating decision.
2. **Scoring → economy:** separate binary outcome (fixed/comeback) from process score; decide how it feeds the
   finite-XP economy + leaderboard. A comeback must never read as a pass.
3. ~~**Schema:** add `nextNodeId`; formalize resolver/`commitsTo` (prototype fakes some).~~ **DONE (2026-07-24).**
   `nextNodeId` + `continueLabel` added (schema + `types.ts`); all 13+ single-option "continue" nodes converted
   across the 4 trees. Schema now enforces: options XOR nextNodeId (no single-option arrays), nextNodeId referential
   integrity, `commitsTo`/`repairs` must name a real seed fault, and `commitsTo` must agree with the repair it routes
   to. Runner scores **repair selection on correctness** (fixed+proven +2 / lucky part-swap 0 / wrong component −2),
   killing the old constant-scoreWeight-on-a-release-button fake (a wrong repair used to score +6). New jest test
   `tests/unit/diag-tree.test.ts` runs all 4 trees through the schema so "the schema validates the trees" is now
   CI-enforced, not a claim. Fixed a phantom fault id in the alternator tree (`repairs:["battery_swap"]` → `[]`).
   Still faked/deferred: the resolver only emits `all-faults-repaired`/`faults-remain` from `#resolve` — `wrong-system`
   is reachable only by a direct decision edge (fine for now).
4. **Storage:** apply `challenge_trees` table when ready (RLS on new table flagged in the SQL).
5. **Real runner UI** (current React is throwaway) + **authoring tooling/template** (SMEs won't hand-write JSON).
6. **Anti-AI top tier:** consider free-text "name your next test" instead of options for capstones.
7. Retrofit the alternator case to the "diagnostic-time-only" budget model (done in the two newer cases).

## Boundaries
Convert nothing from the live bank. Don't touch `challenge_attempts`, auth, RLS, the existing challenge UI, or the
production challenges/questions tables. This whole initiative stays in `proposals/` + the dev-only `/tree-pilot`
until there's a green-lit, SME-authored flagship and a decision to build the real runner.
