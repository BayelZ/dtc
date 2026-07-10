# DTC Session Handoff — 2026-07-10

Read this first, then `CLAUDE.md` for stack/conventions and the Question Content Quality rules
(they encode two real bug chains — position/length/phrase tells, then throwaway distractors — and
the validation gates that prevent them). This file is a snapshot; delete or rewrite it when stale.

## Current state

- Latest commits: `d7ece69` (migrations 019/020 + CLAUDE.md) plus this session's follow-up commit
  (migration 021 + this handoff). Live Supabase project: `nanikmhrhrjfekmtsvdi.supabase.co`.
- **Migrations 019 and 020 have been RUN against the live DB and verified** (140 questions,
  positions 36/35/34/35, max length gap 6 chars, no phrase tells).
- **Migration `021_shop_lore_challenges.sql` is NEW this session — check whether it has been run
  yet.** If not: paste it into the Supabase SQL Editor (single paste is fine at its size). There
  is still no CLI/direct DB access; every migration is run by the user via copy/paste.
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
  putting the TCM in failsafe (Drivetrain, `ro` type). After 021: **17 challenges, 170 questions**.
- All old tells are resolved: positions even (~44/42/42/42), correct-is-longest ~33% with no
  per-question gap >6 chars, zero wrong-only/correct-only repeated 3-grams, zero throwaway
  patterns. These checks must be re-run on ANY new batch (see below).

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
