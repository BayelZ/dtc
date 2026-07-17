# DTC Session Handoff — 2026-07-10

Read this first, then `CLAUDE.md` for stack/conventions and the Question Content Quality rules
(they encode two real bug chains — position/length/phrase tells, then throwaway distractors — and
the validation gates that prevent them). This file is a snapshot; delete or rewrite it when stale.

## Current state

- Latest commits: `d7ece69` (migrations 019/020 + CLAUDE.md) plus this session's follow-up commit
  (migration 021 + this handoff). Live Supabase project: `nanikmhrhrjfekmtsvdi.supabase.co`.
- **Migrations 019 and 020 have been RUN against the live DB and verified** (140 questions,
  positions 36/35/34/35, max length gap 6 chars, no phrase tells).
- Migrations 021-024 have all been RUN and verified live: **30 challenges, 300 questions**
  (positions 78/75/73/74, correct-is-longest 103/300 with max 6-char gap, zero phrase tells).
  There is still no CLI/direct DB access; every migration is run by the user via copy/paste.
- **Incident (2026-07-16, resolved):** running the legacy `all_migrations.sql` (concatenated
  through 018) alongside 024 re-applied 017/018 and silently reverted options/correct_index on
  the original 110 questions while keeping 019's stems — one live question was incoherent.
  Detected by the routine post-migration verification (phrase-tell flood + length-gap spike);
  fixed by re-running 019. The file is deleted from the repo (`37c8a0e`). Lesson: ALWAYS re-run
  the full verification after any DB change, and never keep concatenated migration files in
  `supabase/migrations/`.
- Migration 024 was the first batch through the pre-publish review gate (author → validate →
  review artifact → user findings → Rev 2 → migration). The user's review caught two
  ship-blocking platform errors (see memory: tow ratings, 6.7-vs-LML fuel architecture).
  Keep this workflow for all future content.
- Local dev: `.env.local` has real credentials for the live project. Dev server via
  `mcp__Claude_Preview__preview_start` with name `"dtc-dev"`.

## Content state (the main work of the last two sessions)

- **Migration 019** rewrote distractors on 106 of 110 questions to a professional standard:
  every wrong answer is a plausible same-system competing hypothesis; no "do nothing / ignore it /
  replace X without testing" throwaways, no cross-system absurdities, and the two stems that
  leaked their own answer (P242F tier 0, TCC tier 0) were rewritten.
- **Migration 020** added: Parasitic Draw (Electrical), P0420 Catalyst Efficiency (Emissions),
  U0101 No-Comm TCM (Network).
- **Migration 021** added three narrative "shop lore" challenges with deliberately misleading
  case framing (user asked for "sneaky and entertaining"): the classic vanilla-ice-cream hot-soak
  no-start (Fuel), a "haunted minivan" event-driven wake fault that defeats normal draw testing
  (Electrical), and a $3,800 transmission overhaul quote whose root cause is a corroded ground
  putting the TCM in failsafe (Drivetrain, `ro` type).
- **Migration 022** added five more, filling the thin domains: P0087 GDI two-stage fuel (Fuel),
  P20EE SCR efficiency (Emissions/Diesel), a LIN-bus door-boot chafe — deliberately different
  physics from the two CAN challenges (Network), bearing-vs-diff-whine NVH discrimination
  (Drivetrain), and a P0299 boost leak that defeats static testing (Fuel).
- **Migration 023** added five misdiagnosis/interaction-fault cases: a trailer ground fault
  corrupting CAN (Network), single-tire AWD binding quoted as a coupler (Drivetrain), an EVAP
  small leak that survived three gas caps (Emissions), smart-charge/BMS strategy misread as two
  failed alternators (Electrical), and CCV carryover quoted as a turbo (Emissions/Diesel).
  After 023: **27 challenges, 270 questions**.
- All old tells are resolved: positions even (~70/67/66/67), correct-is-longest ~34% with no
  per-question gap >6 chars, zero wrong-only/correct-only repeated 3-grams, zero throwaway
  patterns. These checks must be re-run on ANY new batch (see below).
- User-added option rules (2026-07-10, from disputed questions — follow these): when a
  distractor is a near-miss, the stem must contain the explicit tiebreaker; unusual techniques
  in correct answers get named in recognizable terms (freeze spray, provocation testing) with
  the explanation saying why the common alternative loses under the stem's stated conditions;
  and where the common technique (swap-to-known-good) genuinely wins — cheap part, instant
  readout — let it be the correct answer sometimes so it isn't a reverse tell.

## Content authoring pipeline (reuse this — it works)

Scratchpad pattern from this session (`build_019/020/021.py` lived in the session scratchpad and
is gone with it; recreate from this description):

1. Pull the live bank with the service-role key (read from `.env.local` via `source`, never
   printed): `curl .../rest/v1/questions?select=*` with `apikey` + `Authorization: Bearer` headers.
2. Author question edits/new questions as JSON files (options array + 0-based `correct_index`,
   correct text placed at its assigned index).
3. One build script per migration that: applies/validates the JSON, runs ALL gates — position
   `Counter` + max same-position run per challenge, correct-is-longest count + per-question gap
   (>6 chars fails), wrong-only and correct-only 3-gram frequency (≥4 occurrences fails), a
   throwaway-pattern regex over wrong options — then emits the SQL (UPDATE-by-qid for edits,
   INSERT...SELECT-by-slug for new challenges, `ON CONFLICT DO NOTHING`).
4. Expect the first authoring pass to fail the length gate (correct answers come out verbose) —
   fix by lengthening a distractor past the correct answer, NOT by padding with reusable phrases,
   and leave ~⅓ of questions with the correct answer longest-by-a-hair so there's no inverse tell.
5. After the user runs the migration, re-pull the live bank and re-run the gates against it.

New challenges also need: a row in `challenges` (types: dtc/wiring/component/ro; specialty
Automotive or Diesel), one `challenge_domains` row (Electrical/Fuel/Emissions/Drivetrain/Network),
and exactly 10 questions, tier_order 0-9, each with an explanation. XP range in use: 90-160.

## Gotchas carried forward

- Supabase SQL Editor: very large pastes (~100+ statements) can throw bogus parse errors — split
  into 2-3 chunks. Its "destructive operation / missing RLS" warnings are usually false positives
  here, but glance at the SQL before dismissing.
- Any dynamic `DROP CONSTRAINT` by pattern-matching a column name is dangerous (matched a UNIQUE
  constraint once, migration 015/016 incident) — query `pg_constraint` by `contype`.
- `preview_eval` can read the live session cookie (`sb-<ref>-auth-token`, base64, sometimes split
  `.0`/`.1` parts) for authenticated REST calls; simpler when appropriate: `source .env.local` in
  Bash and curl with the service-role key (never print it).
- Don't give every challenge the same closing question pair (documentation + "generalized
  sequence") — that template was itself a tell; vary the later tiers per challenge.

## Test invite codes
BAYEL, ZHU (also in `CLAUDE.md`)
