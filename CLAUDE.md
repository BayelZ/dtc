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

## Commands
npm install && npm run type-check && npm test && npm run dev

## Test invite codes
BAYEL, ZHU
