# Tree scoring → economy split (open item #2 — DONE in prototype)

Decision + implementation for how a tree run feeds XP/grade. Prototype-only; nothing wired to
the live economy or `complete_attempt()`. Source of truth: `src/lib/tree/score.ts` (pure fn,
unit-tested in `tests/unit/diag-tree-score.test.ts`).

## The problem it fixes
The old prototype rolled everything into one signed `total`. A comeback could show a positive
number — it "read as a pass." That contradicts how DTC already treats a miss for MCQ.

## The split — two independent axes
1. **OUTCOME (binary gate).** Did the vehicle leave fixed?
   - `clean` / `lucky` → **fixed** → earns XP.
   - `comeback` / `masked` → **0 XP by design**, lands on the **Rework Bench**, breaks the
     clean-sheet streak. This mirrors the existing MCQ comeback pile (`COMEBACK_STAMP_MIN_QUESTIONS`,
     the `no_comebacks` leaderboard column). **A comeback is never a pass.**
2. **PROCESS SCORE (0–100 → letter grade).** How clean was the reasoning — computed
   *independently of the outcome* so it still shows on a comeback (the teaching moment), and
   graded on the **same `scoreToGrade` thresholds** the MCQ economy uses. Ideal path → 100 → A.
   Blend: 0.55·diagnosis(evidence commit) + 0.35·repair correctness + 0.10·time, ± a small path
   adjustment for dead ends.

## The economy mapping
```
fixed   → xp = round(TREE_BASE_XP · processScore/100)   // grade sets the magnitude
!fixed  → xp = 0                                          // Rework Bench, regardless of grade
```
`TREE_BASE_XP = 100` is a prototype knob. A real build scales it per case difficulty and applies
retry decay (`retryDecayRate`), exactly like MCQ.

## The load-bearing invariant (tested)
`THE INVARIANT: a good-process comeback still pays 0 XP` — commit on evidence to fault A, repair
it, but leave fault B → **B-grade process, 0 XP**. Kills "reads as a pass" at the unit level.

## UI (in `TreeRunner`'s OutcomeCard)
Two visually separate sections so the axes never blur:
- **RESULT** header (green/red): outcome tag + headline + big **XP** number + "Clean RO · streak
  intact" / "Rework Bench +1 · 0 XP by design".
- **PROCESS REPORT**: letter grade + `n/100` + the component breakdown, with copy that says the
  grade is earned regardless of outcome but only pays on a fixed RO.

## Knowledge axis — interleaved quiz nodes (added)
A new `quiz` node type sprinkles MCQ knowledge-checks between diagnostic steps (e.g. "where do
you draw the block-test sample?", "how does the reagent work?", "how do you pressure-test?").
- Schema: `type:"quiz"`, options each optionally `correct:true` (exactly one), optional
  `explanation` shown after answering. Routes via its answer options (no `nextNodeId`).
- Runner: distinct blue "◎ Knowledge check" card, lettered options; answering logs ✓/✗ + the
  teaching point to the bench log. Scored on the **process** axis, never the outcome.
- Scoring: `scoreTree` gains a knowledge term (0.15 weight) **only when a case has quizzes** —
  cases without them score identically to before (weights redistribute). Shown as
  "Procedure knowledge · N/M" in the process report.
This is what makes a case *longer without padding*: each test branch now carries real
know-how decisions, and the "how" is taught inline. First case wired: the head-gasket rebuild.

## Content note — head-gasket case is now Cruze-authentic
The `external_leak` seed was a generic "water-pump weep hole" (textbook, not platform-true).
Replaced with the **plastic coolant/water-outlet housing** and a **surge-tank pressure cap**
(the two notorious 1.4T coolant failures), plus a dedicated cap test and a **verification
(road-test) phase**. 4 seeds now, ~70-min diagnostic budget, repairs cost 0 budget-min
(diagnostic-time-only model; the $2,400 job's cost lives in the narrative).

## Economy calibration — why TREE_BASE_XP = 250

Measured against the live MCQ economy rather than guessed.

**What MCQ pays today.** 22 challenges, `xp_reward` 120-160 (mean ~143). A perfect 10-question
session pays the full reward; the speed bonus adds up to `round(xp/10 × 0.5)` per question, so a
perfect *and* fast session tops out near **213**. A realistic strong session is ~160.
The daily multiplier doubles it; `retryDecayRate` halves each replay.

**The mistake we started with.** `TREE_BASE_XP = 100` meant a flawless tree paid *less than a
mediocre MCQ session*, despite taking longer and demanding far more. Backwards.

**Why 250 and not more.** The headline number is misleading on its own, because the tree economy is
**all-or-nothing**: a comeback pays 0, where MCQ still pays partial credit for partial correctness.
So the number that matters is risk-adjusted — `expected = P(fix) × grade × base`:

| Tech | P(fix) | avg grade | expected per run | vs. a strong MCQ session (~160) |
|---|---|---|---|---|
| Novice | 0.30 | 0.70 | **~52** | well below — guessing is punished |
| Mid | 0.55 | 0.80 | **~110** | comparable, for a longer, harder task |
| Skilled | 0.85 | 0.90 | **~191** | above — skill is rewarded |

That spread is the whole point. **XP feeds the shop/hiring portal** (`/shop` — "review candidate
skill ratings, grades and tier for hiring decisions"), so XP is not spendable currency, it is a
**credential an employer reads**. Inflating it doesn't break a store; it devalues the signal. A
format with high variance tied to real competence is exactly what that portal wants, and it is
what MCQ — where a guess still scores — cannot provide.

**Anti-farming.** `treeXpForAttempt()` applies `retryDecayRate` keyed on the **(tree, seed) pair**,
not the tree. Meeting a genuinely new fault in a familiar case pays full; re-running a fault you've
already solved halves each time. With only two trees at launch this is essential — seeds are drawn
at random, so a known pair is otherwise an infinite faucet. **Must be enforced server-side**; the
runner's figure is display-only.

## Open (didn't touch)
- Where this actually writes to the economy (server fn parallel to `complete_attempt()`), the
  finite-XP/leaderboard wiring, and whether a comeback should *cost* XP or just deny it.
- Whether `masked` should rank below `comeback` on the Rework Bench (it leaves a code for the
  next tech — arguably worse). Currently both are 0 XP; only the copy differs.
