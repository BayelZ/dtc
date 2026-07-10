# DTC — Diag Tech Challenge — Claude Code Instructions

## Stack
Next.js 14 Pages Router · Supabase (Postgres + RLS + @supabase/ssr) · TypeScript strict · inline styles · Zod

## Critical Rules
- API routes: ALWAYS `supabase.auth.getUser()`, NEVER `getSession()`
- `correct_index` never in client SELECT strings — server-only via admin client
- XP/grade/tier ALWAYS computed server-side in `/api/attempt/finish.ts` via `complete_attempt()` DB function
- `middleware.ts` at PROJECT ROOT, not inside src/
- Every API route: rate limit → auth → Zod validate → ownership check → admin client action
- PL/pgSQL: ALL variables declared at TOP of DECLARE block, never mid-body
- Leaderboard view has NO ORDER BY (not guaranteed in views) — order in the consuming query

## Grading System
- Score 0-3 → Grade (3=A, 2=B, 1=C, 0=F) via `score_to_grade()`
- Speed bonus: up to 50% extra XP for answering in ≤10s, decays to 0 at 45s
- Skill domain XP: each challenge maps to one of Electrical/Fuel/Emissions/Drivetrain/Network via `challenge_domains` table
- Tier thresholds: Bronze 0, Silver 1000, Gold 2500, Platinum 5000, Master 10000 XP — via `xp_to_tier()`
- All grading constants mirrored between `src/lib/constants.ts`/`utils.ts` and the SQL functions — keep in sync if changed

## Question Content Quality
- When authoring or editing quiz question `options`/`correct_index`: `correct_index` MUST be
  distributed evenly across 0/1/2/3 (A/B/C/D) — NOT clustered on one letter. Before shipping any
  batch of questions, run a distribution check (`Counter` of `correct_index` across all rows) and
  confirm it's roughly even with no long same-letter runs.
- Also validate that the correct answer is not systematically the longest/most-detailed option
  (an easy "pick the longest one" tell), and that no wording/phrase appears disproportionately in
  wrong answers only (a "if it contains X, it's wrong" tell) — check n-gram frequency split by
  correct vs. incorrect before shipping, not after. This exact chain of bugs happened once
  already (migrations 017/018): first the position bias, then a shared filler-phrase bank used to
  fix it that was 137/137 wrong-answer-only, then residual reused phrasing from hand-rewrites.
- Distractors must be plausible same-system competing hypotheses — never "do nothing / ignore it /
  replace X without testing" throwaways or cross-system absurdities (e.g. alternator options on a
  transmission question), and never a stem or challenge title that contains its own answer.
  Migration 019 rewrote the whole bank to this standard; hold new content to it.
- RESOLVED (migrations 019/020): correct-answer-is-longest is down to ~33% (46/140), and no
  question has a correct option more than 6 characters longer than its longest distractor — no
  longer a usable tell. When authoring, keep the per-question length gap under ~6 chars rather
  than chasing the aggregate percentage.

## Commands
npm install && npm run type-check && npm test && npm run dev

## Test invite codes
BAYEL, ZHU
