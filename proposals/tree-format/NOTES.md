# Tree-format pilot — review notes

Proposal only. Nothing wired into the frontend, no migration applied, no existing case touched.

## Files
- `voltage-drop-no-crank.tree.json` — the DiagChallenge tree.
- `diag-tree.schema.ts` — Zod schema (mirrors the spec interface; adds referential-integrity + convention checks). The tree passes it.
- `028_diag_trees_pilot.PROPOSED.sql` — proposed migration, **kept out of `supabase/migrations/`** so it can't be run before review.

## Case identified
Source: **`voltage-drop-no-crank`** — "Voltage Drop — Starter No-Crank," 2019 Chevy Silverado 5.3L (you selected this over the `ro-3800-second-opinion` ground-strap misdiagnosis). Adapted from the live case's real content: good resting battery, slow/no-crank, the two-path voltage-drop method, the positive-feed fault, the recurring **second fault** (corroded engine-to-frame ground strap), the marginal battery from sitting, and the "test both paths under load" lesson. Complaint reworded into service-writer voice; nothing invented beyond the seed variants.

## How it meets the pilot requirements
- **Real dead ends (recoverable):** `act_ohm_static` (static ohms find nothing under load) and `act_replace_starter` (parts-cannon) both cost book-time and loop back to `bay` — the tech eats the time and recovers. The case's signature **misleading lead** is `repair_partial` → `out_comeback`: fix the first fault found and release, and in the dual-fault seed it tows back in three days.
- **Decision node weighted highest:** `scoringRules.decisionNodeWeight = 5` > `repairSelectionWeight = 3`. The correct `decision` option (repair what the under-load readings flag on *both* paths, then verify) is +6; wrong commits are negative.
- **Anti-paste via seeds:** three seeds share the identical node graph and override the identical key set, but the readings differ — positive-side primary + ground secondary (`seed_pos_ground`), ground-only (`seed_ground_primary`), and battery-dominant (`seed_battery_dominant`). The *correct reasoning* is seed-invariant; the *culprit* isn't. There is nothing to paste until the tech has already run tests and seen seed-specific numbers.
- **Shop vocabulary:** DVOM, back-probe, voltage drop under crank, CCA/conductance load test, B+ stud, ground strap, cold-crank cycles.

## Judgment calls / ambiguities
1. **Schema flow (biggest one — needs a decision).** The interface documents `options` as "intake/action/decision nodes only," but a tree can't continue past a `result`/`repair` without a forward link, and there's no `nextNodeId` field. Two clean options:
   - (a) what I did — use a single `options` entry as the forward link on `repair` nodes (the interface's `options?` is optional on every node, so this is type-valid), and skip separate `result` nodes entirely; or
   - (b) add an explicit `nextNodeId?: string` to `DiagNode` for non-branching nodes.
   I recommend (b) for the real build — it makes "terminal vs. pass-through" unambiguous. Flagging rather than deciding it for you.
2. **`result` node type unused.** With seed readings delivered via `resultOverrides` keyed to the **action** nodes (the spec allows overrides on any `nodeId`), I didn't need standalone `result` nodes. Kept the type in the schema; the runner can still use it if (b) above is adopted.
3. **Battery's role.** The source case treats a 78% battery as "recommend replacement." I split that judgment across seeds rather than hard-coding it: marginal-but-not-the-cause in `seed_pos_ground`, and the dominant cause in `seed_battery_dominant`. This preserves the dual-fault wiring lesson without making "replace the battery" always right or always wrong.
4. **Storage: new table vs. JSONB column.** Recommended a **new `challenge_trees` table** over a `diag_tree jsonb` column on `challenges` — the pilot's isolation requirement, easy rollback, and not bloating every existing challenge row with a null column. Rationale is in the migration header.
5. **RLS boundary.** The proposed migration enables RLS + a SELECT policy on the **new** table (standard practice), which is *adding* a policy, not modifying an existing one. Flagged in the SQL for your call given the "do not touch RLS" boundary — pull those three statements if you'd rather handle grants separately.

## ⚠ Book-time TODOs (council-of-elders review — do not treat as final)
`timeCost` values are best-effort minutes; confirm against real book time before scoring goes live:
- `act_replace_starter` = **90 min** — starter R&R on a 5.3L Silverado; the intent is that a parts-cannon dead end blows the 75-min budget. Confirm the real figure.
- `repair_fix_and_verify` = **35 min** and `repair_partial` = **25 min** — clean/replace connection(s) + re-test; rough.
- `act_vdrop_pos` / `act_vdrop_gnd` = **12 min** each, `act_battery_load` / `act_ohm_static` = **10 min** — bench estimates.
- `scoringRules.timeBudgetMinutes` = **75** — derived from the ideal path (~69 min). Recalibrate if the book times above move.

## Boundaries honored
Converted only this one case. No changes to `challenge_attempts`, auth, existing RLS policies, the challenge UI, or any other case. No frontend built. Migration not applied.
