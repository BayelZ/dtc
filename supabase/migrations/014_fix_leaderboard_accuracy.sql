-- Bug: accuracy_pct could exceed 100%. SUM(a.score) was unfiltered while
-- SUM(a.total_questions) was FILTER (WHERE a.completed) — an in-progress
-- attempt's partial score counted in the numerator without its questions
-- ever counting in the denominator. Filter both sides identically.
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
    THEN ROUND(SUM(a.score) FILTER (WHERE a.completed)::NUMERIC/SUM(a.total_questions) FILTER (WHERE a.completed)*100)::INTEGER ELSE 0 END AS accuracy_pct,
  RANK() OVER (ORDER BY p.xp DESC)::INTEGER AS rank,
  RANK() OVER (PARTITION BY p.specialty ORDER BY p.xp DESC)::INTEGER AS specialty_rank
FROM public.profiles p
LEFT JOIN public.user_badges ub ON ub.user_id=p.id
LEFT JOIN public.attempt_summaries a ON a.user_id=p.id
GROUP BY p.id, p.full_name, p.shop_name, p.specialty, p.xp, p.streak, p.tier;
