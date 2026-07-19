# DTC Session Handoff — 2026-07-18

Read this first, then `CLAUDE.md` (conventions, critical rules, Question Content Quality gates)
and the auto-memory (`feedback_quiz_content_validation` has six hard-won authoring rules).
Snapshot doc — delete or rewrite when stale.

## ⚠ OPEN ISSUE — start here

The session ended with the user reporting **"no it did not work"** right after two things:
(1) the NO COMEBACKS stamp test, and (2) being asked to run migration `026_founding_tech_badge.sql`.
It is **unknown which one failed** — first move is to ask the user what exactly they saw.
Diagnostic tree, in the order I'd check:

1. **Ask what "didn't work" means** — no stamp visible on the leaderboard? 026 threw an error?
   Founding Tech badge missing? Leaderboard page broken entirely?
2. **Suspect #1 — leaderboard.tsx client select string.** `src/views/profile.tsx` selects
   `comebacks_cleared,no_comebacks` explicitly; I never confirmed `src/views/leaderboard.tsx`'s
   select string includes the three new columns (`comebacks_open,comebacks_cleared,no_comebacks`).
   If its select is an explicit column list without them, `u.no_comebacks` is undefined and the
   chip never renders. One-line fix.
3. **Suspect #2 — grants on `comeback_summaries` (serious).** ALL of this session's live
   verification used the **service role**, which bypasses RLS and masks permission problems.
   The `leaderboard` view is `security_invoker`; its scalar subqueries read
   `public.comeback_summaries` (a definer view mirroring the `attempt_summaries` pattern).
   If the project's default privileges did NOT grant authenticated SELECT on the new view,
   every real user's leaderboard query now fails with permission denied — i.e. migration 025
   may have **broken the leaderboard page for actual users** while looking perfect via service
   role. Test with an ANON/authenticated token, not service role. Fix if so:
   `GRANT SELECT ON public.comeback_summaries TO authenticated, anon;` (new migration).
4. **Confirm 026 state**: does `badges` have 'Founding Tech'? Do all ~10 profiles have it in
   `user_badges`? Is `handle_new_user()` the 026 version (contains the award block)? If the user
   never ran 026 or it errored, that alone explains a missing founder badge.
5. **Vercel deploy**: the comeback feature code is in commits `356b24d`/`b43548e` — confirm the
   deployed build is current before chasing code bugs.

Verified-good facts to build on (all via service role, 2026-07-18): `qwdsqw`
(id `056b8f8a-...`) has `no_comebacks=true`, `comebacks_cleared=7`, badge 'Made Right', streak
credit applied — the RPC path works. Note: I cleared that test account's pile permanently via
`record_comeback_answer` as the test.

## Current live state

- **DB (Supabase `nanikmhrhrjfekmtsvdi`)**: migrations through **025 RUN and verified**.
  026 (Founding Tech) is committed at `a2029cc` — **run status unknown** (see open issue).
  No CLI/DB access from here: user pastes migrations into the SQL Editor manually.
- **Content**: 30 challenges / 300 questions, all quality gates green (positions ~78/75/73/74,
  correct-is-longest 103/300 with max 6-char gap, zero phrase/throwaway tells).
- **App**: open signup live (invite gate removed; signups tagged `invite_code='HOUSTON-BETA'`
  via `OPEN_BETA_INVITE_TAG`). InviteGate + `/api/invite/validate` remain in-tree, unrouted.
- **Comeback Pile ("Rework Bench") shipped**: migration 025 (comebacks table + RLS +
  `comeback_summaries` + backfill (61 rows/8 users) + `record_comeback_answer()` +
  `award_comeback_badges()` + extended `complete_attempt()` + leaderboard columns),
  `api/comeback/{queue,answer}.ts`, `src/views/bench.tsx` (blueprint-blue mode),
  dashboard card, profile counter, NO COMEBACKS chip in leaderboard.tsx.
  Mechanics: zero XP (deliberate — see below), streak credit on clears, misses to back of line,
  clears happen anywhere (bench or replay), stamp = pile empty + ≥50 questions lifetime
  (mirrored constant `COMEBACK_STAMP_MIN_QUESTIONS`).
- **Marketing**: ad copy (`marketing/houston-beta-ads.md`), final Standings ad renders
  (`marketing/ad-assets/`, PNG+JPG, 1:1/4:5/9:16 — domain on them is a PLACEHOLDER
  `diagtechchallenge.com`, and the board handles are fictional; re-render before spending).
  Field copy locked: headline "LeetCode for mechanics", primary "27 real cases technicians argue
  about at lunch — scored, timed, ranked, no parts cannon. Free while in beta." (bank is 300 now —
  update the number in copy). Ad artifacts: Standings production page + Rework Bench direction
  page + batch-024 review page (claude.ai artifacts, session-scoped links in chat history).

## Design decisions that must survive (agreed with user, don't relitigate)

- **XP is a finite pool** (never re-earn correct; retry decay). Comebacks pay ZERO XP forever —
  any payout creates sandbagging (deliberately missing to bank inventory). Rewards are: streak
  credit, lifetime cleared counter, Made Right / Clean Bench badges, and the revocable stamp.
- **Tier thresholds stay as-is for beta**; Master is intentionally unreachable until the catalog
  grows (~5,460 XP obtainable max today). Calibrate from beta data, not guesses.
- **Review gate for ALL new content**: author → validate (position/length/phrase/throwaway
  gates) → review artifact → user findings → Rev 2 → migration. The user's reviews have caught
  ship-blocking errors twice (tow ratings, 6.7-vs-LML fuel architecture — now memory rule #6).
- **Visual system**: black + amber `#E2932F` for the competitive app/ads (instrument-panel,
  Archivo Black + IBM Plex Mono direction); blueprint blue `#0C2740` + soapstone `#E9EEF2` +
  primer oxide `#B0523B` exclusively for the Rework Bench. Amber and blue never share a screen
  except the dashboard's pile card. No barker copy — evidence, deadpan, never address the viewer.

## Gotchas (each cost real time this session)

- `CREATE OR REPLACE VIEW` can only APPEND columns at the end — inserting before existing ones
  throws 42P16 (hit this on the leaderboard view; comment now in 025).
- **Service-role verification masks RLS/grant failures** — always ALSO test new views/tables
  with an authenticated-role token (this is likely tonight's bug, see open issue).
- Never keep concatenated migration files in `supabase/migrations/` — `all_migrations.sql`
  (ended at 018) got run alongside 024 and silently reverted 019's option rewrites; caught only
  by the routine post-migration verification (phrase-tell flood + length-gap spike). File deleted
  (`37c8a0e`); ALWAYS re-run full verification after any DB change.
- The embedded preview browser **cannot reach supabase.co** — the app hangs at "Loading…"
  locally for everyone; verify data via service-role REST (`source .env.local`, never print
  keys) and UI logic via type-check/tests; final eyeball happens on the Vercel deploy.
- `python3 -m http.server` fails in the sandbox (`os.getcwd` EPERM) — use a tiny Node server
  for static mockups. Headless Chrome isn't installed; **headless Firefox** renders ad PNGs
  (one profile dir per run or shots silently drop).
- Supabase SQL Editor: giant pastes can throw phantom parse errors (split ~100+ statements);
  its destructive-operation warnings are usually false positives here.

## Pre-launch checklist (ads should not spend until these close)

1. Resolve the open issue above (stamp/026/possible leaderboard grants break).
2. Throwaway-signup test on the deployed site: lands on auth form, signup completes,
   profile has `invite_code='HOUSTON-BETA'`, Founding Tech badge attached.
3. Re-render ad assets with the real domain + real tester handles (with permission);
   update "27 real cases" → current count in field copy.
4. Post-launch week-one roadmap (agreed priorities): per-question flag button ("dispute"),
   per-question wrong-rate analytics, weekly leaderboard view styled as the Standings ad,
   Daily Case at 2× XP (plumbing exists: `DAILY_XP_MULTIPLIER`/`isDaily` — no UI trigger).

## Test invite codes
BAYEL, ZHU (also in `CLAUDE.md`) — signup no longer requires them.
