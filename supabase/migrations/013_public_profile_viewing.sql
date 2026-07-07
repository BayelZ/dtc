-- Achievements are meant to be visible bragging-rights indicators (like the
-- badges table itself already is) — no sensitive data in user_badges.
DROP POLICY IF EXISTS "user_badges_select_own" ON public.user_badges;
DROP POLICY IF EXISTS "user_badges_select_public" ON public.user_badges;
CREATE POLICY "user_badges_select_public" ON public.user_badges FOR SELECT TO authenticated USING (TRUE);

-- attempts.answers stores each question's correct_index — CLAUDE.md's rule
-- ("correct_index never in client SELECT") means the base attempts table
-- must stay locked to owner-only (attempts_select_own, unchanged). But
-- viewing another mechanic's public profile needs their aggregate stats
-- (score/grade/timing), so expose only the safe columns via a view that
-- deliberately omits `answers`.
--
-- This view is intentionally NOT security_invoker — it runs with the view
-- owner's privileges, bypassing attempts' per-row RLS, which is exactly
-- what lets it aggregate every user's rows for cross-user stats. This is
-- safe *only* because its column list can never include `answers`; if a
-- column is ever added here, verify it isn't `answers` or anything else
-- that reveals unanswered correct_index values.
CREATE OR REPLACE VIEW public.attempt_summaries AS
SELECT id, user_id, challenge_id, score, total_questions, xp_earned, speed_bonus_xp, time_seconds, grade, completed, created_at
FROM public.attempts;

-- Leaderboard's grade/completion/accuracy aggregates previously came from a
-- direct join against attempts, which — because the view is (correctly)
-- security_invoker — meant those columns silently read as 0 for every row
-- except the querying user's own, since attempts_select_own blocked the rest.
-- Join the safe view instead so aggregates are accurate for every row.
CREATE OR REPLACE VIEW public.leaderboard WITH (security_invoker=TRUE) AS
SELECT
  p.id, p.full_name, p.shop_name, p.specialty::TEXT AS specialty, p.xp, p.streak, p.tier::TEXT AS tier,
  COUNT(DISTINCT ub.badge_id)::INTEGER AS badge_count,
  COUNT(DISTINCT a.id) FILTER (WHERE a.grade='A')::INTEGER AS grade_a_count,
  COUNT(DISTINCT a.id) FILTER (WHERE a.grade='B')::INTEGER AS grade_b_count,
  COUNT(DISTINCT a.id) FILTER (WHERE a.grade='C')::INTEGER AS grade_c_count,
  COUNT(DISTINCT a.id) FILTER (WHERE a.grade='F')::INTEGER AS grade_f_count,
  COUNT(DISTINCT a.id) FILTER (WHERE a.completed)::INTEGER AS challenges_completed,
  CASE WHEN SUM(a.total_questions) FILTER (WHERE a.completed)>0
    THEN ROUND(SUM(a.score)::NUMERIC/SUM(a.total_questions) FILTER (WHERE a.completed)*100)::INTEGER ELSE 0 END AS accuracy_pct,
  RANK() OVER (ORDER BY p.xp DESC)::INTEGER AS rank,
  RANK() OVER (PARTITION BY p.specialty ORDER BY p.xp DESC)::INTEGER AS specialty_rank
FROM public.profiles p
LEFT JOIN public.user_badges ub ON ub.user_id=p.id
LEFT JOIN public.attempt_summaries a ON a.user_id=p.id
GROUP BY p.id, p.full_name, p.shop_name, p.specialty, p.xp, p.streak, p.tier;
