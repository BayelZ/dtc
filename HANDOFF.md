# DTC Session Handoff — 2026-07-19

Read this first, then `CLAUDE.md` (conventions, critical rules, Question Content Quality gates)
and the auto-memory (`feedback_quiz_content_validation` has six hard-won authoring rules).
Snapshot doc — delete or rewrite when stale.

## Last session's open issue — RESOLVED

The 2026-07-18 "no it did not work" report is fully closed:

- **The NO COMEBACKS stamp was working all along.** Verified 2026-07-19 with a real
  authenticated token (throwaway account via admin API, deleted after): leaderboard view
  readable by authenticated role, all three comeback columns present, `qwdsqw` returns
  `no_comebacks=true`. Both handoff suspects cleared — `leaderboard.tsx` uses `select("*")`,
  and default privileges cover `comeback_summaries` (no explicit GRANT needed, same as
  `attempt_summaries`).
- **Migration 026 had never been applied** — that was the real failure. The user's repeated
  `42P16: cannot drop columns from view` errors came from **stale SQL Editor tab content**
  (an old leaderboard-view definition re-executing alongside/instead of the paste), not from
  026 itself, which contains no view DDL.
- **026 is now fully live** (2026-07-19), applied in two parts:
  - Badge INSERT + backfill applied **via service-role REST** (PostgREST upsert with
    `on_conflict=name` / `on_conflict=user_id,badge_id`). Badge id
    `32528c91-3850-4280-aa79-534bfa4a16b4`; all 11 profiles have it in `user_badges`.
  - `handle_new_user()` function block run by the user in a fresh SQL Editor tab — success.
  - End-to-end verified: a fresh admin-API signup auto-received Founding Tech (and only
    that); test account deleted cleanly (profile cascade confirmed).

## ⚠ Open items

1. **Deployment URL is unknown from this machine.** `NEXT_PUBLIC_APP_URL=localhost:3000`,
   no `.vercel/` dir, no vercel.app string anywhere in the repo, `gh` not installed,
   `dtc.vercel.app` is someone else's project. Ask the user for the production URL and
   record it here. Until then, nothing about the deployed build can be verified from here.
2. **User may be seeing a stale deploy.** On 2026-07-19 the user asked (again) to "remove
   invite code requirement and let everyone signup" — but open signup has been fully
   implemented in code since `356b24d`: `index.tsx` renders `AuthForm` directly with
   `inviteCode={OPEN_BETA_INVITE_TAG}` ("HOUSTON-BETA"), no invite field exists, InviteGate
   is in-tree but unrouted. `origin/main` matches local. If the live site still shows an
   invite prompt, the deployed build predates `356b24d` (failed/missing Vercel build) —
   get the URL, check what's deployed, redeploy if needed. Do NOT "re-remove" the gate in
   code; it's already gone.
3. **Deployed-site signup test** (pre-launch checklist): sign up through the real site's
   form and confirm profile gets `invite_code='HOUSTON-BETA'` + Founding Tech badge. The
   admin-API test bypasses the app form, so the tag path specifically is still unverified.
4. Re-render ad assets with the real domain + real tester handles (with permission);
   update "27 real cases" → 300 in field copy (`marketing/houston-beta-ads.md`,
   `marketing/ad-assets/` — currently uncommitted/untracked).
5. Post-launch week-one roadmap (agreed priorities): per-question flag button ("dispute"),
   per-question wrong-rate analytics, weekly leaderboard view styled as the Standings ad,
   Daily Case at 2× XP (plumbing exists: `DAILY_XP_MULTIPLIER`/`isDaily` — no UI trigger).

## Current live state

- **DB (Supabase `nanikmhrhrjfekmtsvdi`)**: migrations through **026 RUN and verified**
  (026 partially via REST, see above — DB state matches the migration file exactly).
  No CLI/DB access from here beyond service-role REST: user pastes SQL into the SQL
  Editor manually. No psql, no supabase CLI, no management-API token on this machine.
- **Content**: 30 challenges / 300 questions, all quality gates green (positions
  ~78/75/73/74, correct-is-longest 103/300 with max 6-char gap, zero phrase/throwaway
  tells).
- **App**: open signup live in code (invite gate removed; signups tagged
  `invite_code='HOUSTON-BETA'` via `OPEN_BETA_INVITE_TAG`). InviteGate +
  `/api/invite/validate` remain in-tree, unrouted. Deploy currency UNVERIFIED (item 1/2).
- **Comeback Pile ("Rework Bench")**: fully shipped and now verified under the
  authenticated role, not just service role. Mechanics: zero XP (deliberate), streak
  credit on clears, misses to back of line, clears anywhere, stamp = pile empty +
  ≥50 lifetime questions (`COMEBACK_STAMP_MIN_QUESTIONS`).
- **Founding Tech badge**: live, backfilled to all 11 profiles, auto-awarded on signup
  by `handle_new_user()` (026 version). WHEN BETA ENDS: ship a migration removing the
  award block (comment marks it).
- **Marketing**: ad copy (`marketing/houston-beta-ads.md`), final Standings ad renders
  (`marketing/ad-assets/`, PNG+JPG, 1:1/4:5/9:16 — domain on them is a PLACEHOLDER
  `diagtechchallenge.com`, board handles fictional; re-render before spending). Field
  copy locked: headline "LeetCode for mechanics", primary "27 real cases technicians
  argue about at lunch — scored, timed, ranked, no parts cannon. Free while in beta."
  (bank is 300 now — update the number).

## Design decisions that must survive (agreed with user, don't relitigate)

- **XP is a finite pool** (never re-earn correct; retry decay). Comebacks pay ZERO XP
  forever — any payout creates sandbagging. Rewards: streak credit, lifetime cleared
  counter, Made Right / Clean Bench badges, revocable stamp.
- **Tier thresholds stay as-is for beta**; Master intentionally unreachable until the
  catalog grows (~5,460 XP obtainable max today). Calibrate from beta data.
- **Review gate for ALL new content**: author → validate (position/length/phrase/throwaway
  gates) → review artifact → user findings → Rev 2 → migration. User reviews have caught
  ship-blocking errors twice (tow ratings, 6.7-vs-LML fuel architecture).
- **Visual system**: black + amber `#E2932F` for the competitive app/ads; blueprint blue
  `#0C2740` + soapstone `#E9EEF2` + primer oxide `#B0523B` exclusively for the Rework
  Bench. Amber and blue never share a screen except the dashboard's pile card. No barker
  copy — evidence, deadpan, never address the viewer.

## Gotchas (each cost real time)

- **Supabase SQL Editor executes the SELECTED text if any text is highlighted**, and tabs
  keep old content between sessions. This caused two sessions of phantom `42P16` errors:
  the user was unknowingly re-running an old leaderboard-view query, not the pasted
  migration. Always have the user paste into a **fresh "+ New query" tab** and click to
  deselect before Run.
- `CREATE OR REPLACE VIEW` can only APPEND columns at the end — inserting before existing
  ones throws 42P16 (comment in 025).
- **Service-role verification masks RLS/grant failures** — also test new views/tables with
  an authenticated token. Working recipe: create a confirmed throwaway via
  `POST /auth/v1/admin/users` (service role), `POST /auth/v1/token?grant_type=password`
  (anon apikey) for an access token, query REST with it, then
  `DELETE /auth/v1/admin/users/{id}` (cascades the profile — verified).
- **Anon (logged-out) role sees zero rows** on `leaderboard` and `badges` — expected
  (security_invoker + RLS `TO authenticated`), don't mistake it for a grants break.
- **`UID` is a readonly zsh variable** — using it as a shell var name in Bash-tool
  one-liners throws "bad math expression". Use `TUID` etc.
- Migrations 001–007 are NOT in the repo (`supabase/migrations/` starts at 008) — early
  schema (badges table, uniques) can't be read locally; probe live via PostgREST instead.
- Never keep concatenated migration files in `supabase/migrations/` — the
  `all_migrations.sql` incident silently reverted 019 once. ALWAYS re-run full
  verification after any DB change.
- The embedded preview browser **cannot reach supabase.co** — verify data via
  service-role REST (`source .env.local`, never print keys); final eyeball on the deploy.
- `python3 -m http.server` fails in the sandbox (EPERM) — tiny Node server instead.
  Headless Chrome not installed; headless Firefox renders ad PNGs (one profile dir per
  run or shots silently drop).

## Test invite codes
BAYEL, ZHU (also in `CLAUDE.md`) — signup no longer requires them.
