# Beta release — the two approved tree cases

Scope: **`cooling-second-opinion`** ("Everyone Said Head Gasket", 2013 Cruze 1.4T) and
**`p0420-second-opinion`** ("The Cat That Wasn't Dead", 2013 Camry 2.5L).
The other five trees stay dev-only at `/tree-pilot`.

## Done — content is frozen and release-ready

- [x] Both trees pass the canonical Zod schema (`tests/unit/diag-tree.test.ts`, in CI).
- [x] Quiz content gates run across the batch: positions A4/B3/C3/D2, max correct-vs-longest-
      distractor gap **4 chars**, no phrase tells in either direction.
- [x] Platform-authentic parts (Cruze outlet housing + surge-tank cap; P0420 rear-sensor/leak/
      compound-misfire), not textbook-generic.
- [x] `"(tree pilot)"` stripped from the head-gasket title — dev artifact, would have shipped.
- [x] Both play end-to-end in the runner, including the compound-fault comeback.
- [x] Economy calibrated (`TREE_BASE_XP = 250`) + anti-farm decay — see SCORING-ECONOMY.md.
- [x] Release migration written: **`028_diag_trees_release.sql`** — creates `challenge_trees`,
      seeds both documents (verified byte-identical to the files the runner loads), ships them
      `is_published = false` behind an RLS read policy so they can be loaded and reviewed
      before going live.

## Done — server-side scoring is built

- [x] **Answer key stays server-side.** `faultSeeds` (which fault is real, which test reveals it,
      every reading) is stripped by `sanitizeTreeForClient()` before anything ships to a browser;
      readings are released one node at a time by `/api/tree/step` as the tech actually runs each
      test. Migration 029 also **revokes column access** to `challenge_trees.tree` from
      `authenticated`, so a client can't read it directly either — the correct_index rule applied
      to trees. Asserted in `tests/unit/diag-tree-engine.test.ts`.
- [x] **Scoring moved server-side.** `/api/tree/finish` replays the stored path against the
      server's seed, scores it with `scoreTree()`, applies `treeXpForAttempt()` decay from real
      attempt history, and writes XP through `complete_tree_attempt()` — the tree equivalent of
      `complete_attempt()`. The client sends only an attempt id.
- [x] **Forged paths rejected.** Every transition is validated against the tree, and the server
      refuses a step taken from a node the run isn't actually on. Tested.
- [x] **Attempt storage.** New `tree_attempts` table (029) — deliberately NOT `attempts`, whose
      shape the leaderboard and comeback pile depend on.
- [x] **Production runner** `TreeCaseRunner.tsx` — API-driven, no answer key, no dev affordances.
- [x] **Placement** — featured "Diagnostic cases" rail at the top of the Challenge arena.

## Blocking — still to do

- [ ] **Apply the migrations and publish.** They're in `supabase/migrations/` now but ship
      `is_published = false`; nothing is visible until you flip it (command below).
- [ ] **Comeback → Rework Bench wiring.** A tree comeback currently pays 0 XP but does not yet
      land on the existing bench or break the `no_comebacks` clean sheet. Needs a decision on
      whether a tree comeback enters the same queue (its content isn't a question, so the
      existing comeback row shape doesn't fit as-is).
- [ ] **End-to-end test against a real database.** Everything is unit-tested and the app builds,
      but no run has gone through Supabase yet — the migrations have not been applied anywhere.

## Decisions needed from you

1. **Skill-domain gap.** `SKILL_DOMAINS` is Electrical/Fuel/Emissions/Drivetrain/Network.
   The catalyst case maps cleanly to **Emissions**. The head-gasket case is cooling / engine
   mechanical and maps to **nothing** — so it would earn no domain XP. Either add a domain
   (e.g. "Engine Mechanical") or accept that this case pays general XP only.
2. **Topic overlap with the MCQ bank.** An MCQ challenge `p0420-cat-efficiency` already exists
   (2014 Civic). The tree is a different vehicle, native-authored, not a conversion — but a beta
   user will see P0420 twice in two formats. Fine (arguably good: same fault, deeper treatment),
   but it's a deliberate call, not an accident.
3. **Daily multiplier.** Should `DAILY_XP_MULTIPLIER` apply to trees? At 250 base a daily tree
   would pay up to 500. Recommend **no** for beta — keep the daily on MCQ.
4. **Book times.** All `timeCost` values remain dev estimates. They drive the time-efficiency
   score, so a council-of-elders pass matters before these count toward a real leaderboard.

## To go live

Migrations `028_diag_trees.sql` and `029_tree_attempts.sql` are in `supabase/migrations/`.
Apply them (they are additive and idempotent; nothing existing is altered):

```bash
supabase db push
```

Both cases land `is_published = false`, so **applying changes nothing a user sees**. When you
want them visible:

```sql
UPDATE public.challenge_trees SET is_published = true
 WHERE slug IN ('cooling-second-opinion','p0420-second-opinion');
```

To pull them back instantly, set `is_published = false` again — no deploy needed.
