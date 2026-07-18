-- 025_comeback_pile.sql
-- The Comeback Pile ("Rework Bench"): every question answered wrong lands on a
-- per-user pile and stays there until answered correctly — in a bench session
-- or a normal challenge replay; a fixed job is fixed wherever it's fixed.
-- Zero XP by design (the finite XP pool stays untouched). Rewards: streak
-- credit for clears, a lifetime cleared counter, two badges, and the revocable
-- NO COMEBACKS leaderboard stamp (pile empty + 50 questions answered lifetime).

-- ============================================================
-- 1. Table + RLS: users read their own pile; all writes go through
--    SECURITY DEFINER functions / the service role.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.comebacks (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  missed_count INTEGER NOT NULL DEFAULT 1,
  cleared_count INTEGER NOT NULL DEFAULT 0,
  first_missed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_missed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cleared_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, question_id)
);
CREATE INDEX IF NOT EXISTS comebacks_open_idx
  ON public.comebacks (user_id, last_missed_at) WHERE cleared_at IS NULL;

ALTER TABLE public.comebacks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comebacks_select_own" ON public.comebacks;
CREATE POLICY "comebacks_select_own" ON public.comebacks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 2. Cross-user-safe aggregate view (attempt_summaries pattern).
--    Exposes NO question ids — which questions a user misses stays private;
--    the leaderboard only needs open/cleared counts.
-- ============================================================
CREATE OR REPLACE VIEW public.comeback_summaries AS
SELECT user_id, cleared_count, (cleared_at IS NULL) AS open
FROM public.comebacks;

-- ============================================================
-- 3. Badges
-- ============================================================
INSERT INTO public.badges (name,description,icon,criteria) VALUES
  ('Made Right','Cleared your first comeback','🔧','{"comebacks_cleared":1}'),
  ('Clean Bench','Cleared ten comebacks and worked the pile down to zero','🧰','{"comebacks_cleared":10,"pile_empty":true}')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 4. Badge helper (shared by bench answers and challenge replays)
-- ============================================================
CREATE OR REPLACE FUNCTION public.award_comeback_badges(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_cleared BIGINT; v_open BIGINT; v_badge_id UUID;
BEGIN
  SELECT COALESCE(SUM(cleared_count),0), COUNT(*) FILTER (WHERE cleared_at IS NULL)
    INTO v_cleared, v_open FROM public.comebacks WHERE user_id=p_user_id;
  IF v_cleared>=1 THEN
    SELECT id INTO v_badge_id FROM public.badges WHERE name='Made Right';
    IF v_badge_id IS NOT NULL THEN INSERT INTO public.user_badges(user_id,badge_id) VALUES (p_user_id,v_badge_id) ON CONFLICT DO NOTHING; END IF;
  END IF;
  IF v_cleared>=10 AND v_open=0 THEN
    SELECT id INTO v_badge_id FROM public.badges WHERE name='Clean Bench';
    IF v_badge_id IS NOT NULL THEN INSERT INTO public.user_badges(user_id,badge_id) VALUES (p_user_id,v_badge_id) ON CONFLICT DO NOTHING; END IF;
  END IF;
END; $$;

-- ============================================================
-- 5. record_comeback_answer: a bench answer. Correctness is checked entirely
--    server-side (correct_index never leaves the DB before the answer lands).
--    Clears feed the streak with the same CASE logic as complete_attempt.
--    Wrong answers bump last_missed_at, which sends the tag to the back of
--    the line (the queue orders by last_missed_at ascending). Zero XP.
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_comeback_answer(
  p_user_id UUID, p_question_id UUID, p_selected INTEGER
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_correct_index INTEGER; v_explanation TEXT; v_is_correct BOOLEAN;
  v_open BIGINT; v_cleared_total BIGINT;
BEGIN
  IF p_selected < -1 OR p_selected > 3 THEN RAISE EXCEPTION 'selected out of range: %', p_selected; END IF;
  PERFORM 1 FROM public.comebacks
    WHERE user_id=p_user_id AND question_id=p_question_id AND cleared_at IS NULL
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no open comeback for question %', p_question_id; END IF;
  SELECT correct_index, explanation INTO v_correct_index, v_explanation
    FROM public.questions WHERE id=p_question_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'question % not found', p_question_id; END IF;

  v_is_correct := (p_selected = v_correct_index);
  IF v_is_correct THEN
    UPDATE public.comebacks SET cleared_at=NOW(), cleared_count=cleared_count+1
      WHERE user_id=p_user_id AND question_id=p_question_id;
    -- streak credit: same expression as complete_attempt(); SET clauses read
    -- the pre-update row, so the CASE sees the old last_active.
    UPDATE public.profiles SET
      streak = CASE WHEN last_active=CURRENT_DATE-INTERVAL '1 day' THEN streak+1
                    WHEN last_active=CURRENT_DATE THEN streak ELSE 1 END,
      last_active = CURRENT_DATE
      WHERE id=p_user_id;
    PERFORM public.award_comeback_badges(p_user_id);
  ELSE
    UPDATE public.comebacks SET missed_count=missed_count+1, last_missed_at=NOW()
      WHERE user_id=p_user_id AND question_id=p_question_id;
  END IF;

  SELECT COUNT(*) FILTER (WHERE cleared_at IS NULL), COALESCE(SUM(cleared_count),0)
    INTO v_open, v_cleared_total FROM public.comebacks WHERE user_id=p_user_id;
  RETURN jsonb_build_object(
    'is_correct',v_is_correct,'correct_index',v_correct_index,'explanation',v_explanation,
    'open_remaining',v_open,'cleared_total',v_cleared_total);
END; $$;

-- ============================================================
-- 6. complete_attempt(): unchanged XP/grade/badge/streak behavior, plus pile
--    maintenance at the end — misses land on the pile, correct answers clear
--    any open tags (a replay fix counts). Full rewrite of the 008 function.
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_attempt(
  p_attempt_id UUID, p_xp_earned INTEGER, p_speed_bonus INTEGER DEFAULT 0, p_time_seconds INTEGER DEFAULT 0
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_user_id UUID; v_score INTEGER; v_total INTEGER; v_challenge_id UUID;
  v_specialty TEXT; v_domain public.skill_domain; v_grade public.grade;
  v_badge_id UUID; v_completed_count BIGINT; v_streak INTEGER; v_diesel_count BIGINT;
  v_new_xp INTEGER; v_old_tier public.tier; v_new_tier public.tier; v_total_xp_earned INTEGER;
  v_answers JSONB;
BEGIN
  SELECT user_id, score, total_questions, challenge_id, answers
    INTO v_user_id, v_score, v_total, v_challenge_id, v_answers
    FROM public.attempts WHERE id=p_attempt_id AND completed=FALSE FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'attempt % not found or already completed', p_attempt_id; END IF;
  IF p_xp_earned<0 OR p_xp_earned>2000 THEN RAISE EXCEPTION 'xp out of range: %', p_xp_earned; END IF;
  IF p_speed_bonus<0 OR p_speed_bonus>1000 THEN RAISE EXCEPTION 'speed bonus out of range: %', p_speed_bonus; END IF;
  v_total_xp_earned := p_xp_earned + p_speed_bonus;
  v_grade := public.score_to_grade(v_score, v_total);
  SELECT specialty::TEXT INTO v_specialty FROM public.challenges WHERE id=v_challenge_id;
  SELECT domain INTO v_domain FROM public.challenge_domains WHERE challenge_id=v_challenge_id;

  UPDATE public.attempts SET completed=TRUE, xp_earned=v_total_xp_earned, speed_bonus_xp=p_speed_bonus, time_seconds=p_time_seconds, grade=v_grade WHERE id=p_attempt_id;

  SELECT tier INTO v_old_tier FROM public.profiles WHERE id=v_user_id;

  UPDATE public.profiles SET
    xp = xp + v_total_xp_earned, last_active = CURRENT_DATE,
    streak = CASE WHEN last_active=CURRENT_DATE-INTERVAL '1 day' THEN streak+1 WHEN last_active=CURRENT_DATE THEN streak ELSE 1 END,
    tier = public.xp_to_tier(xp + v_total_xp_earned)
  WHERE id=v_user_id RETURNING xp INTO v_new_xp;

  IF v_domain IS NOT NULL THEN
    INSERT INTO public.skill_scores (user_id,domain,xp,attempts,correct) VALUES (v_user_id,v_domain,v_total_xp_earned,1,v_score)
    ON CONFLICT (user_id,domain) DO UPDATE SET xp=skill_scores.xp+v_total_xp_earned, attempts=skill_scores.attempts+1, correct=skill_scores.correct+v_score, updated_at=NOW();
  END IF;

  SELECT tier INTO v_new_tier FROM public.profiles WHERE id=v_user_id;
  SELECT COUNT(*) INTO v_completed_count FROM public.attempts WHERE user_id=v_user_id AND completed=TRUE;

  IF v_completed_count=1 THEN
    SELECT id INTO v_badge_id FROM public.badges WHERE name='First Start';
    IF v_badge_id IS NOT NULL THEN INSERT INTO public.user_badges(user_id,badge_id) VALUES (v_user_id,v_badge_id) ON CONFLICT DO NOTHING; END IF;
  END IF;

  IF v_score=v_total AND v_total>0 THEN
    SELECT id INTO v_badge_id FROM public.badges WHERE name='Perfect Run';
    IF v_badge_id IS NOT NULL THEN INSERT INTO public.user_badges(user_id,badge_id) VALUES (v_user_id,v_badge_id) ON CONFLICT DO NOTHING; END IF;
  END IF;

  SELECT streak INTO v_streak FROM public.profiles WHERE id=v_user_id;
  IF v_streak>=7 THEN
    SELECT id INTO v_badge_id FROM public.badges WHERE name='Streak Week';
    IF v_badge_id IS NOT NULL THEN INSERT INTO public.user_badges(user_id,badge_id) VALUES (v_user_id,v_badge_id) ON CONFLICT DO NOTHING; END IF;
  END IF;

  IF v_specialty='Diesel' THEN
    SELECT COUNT(*) INTO v_diesel_count FROM public.attempts a JOIN public.challenges c ON c.id=a.challenge_id
      WHERE a.user_id=v_user_id AND a.completed=TRUE AND c.specialty::TEXT='Diesel';
    IF v_diesel_count>=10 THEN
      SELECT id INTO v_badge_id FROM public.badges WHERE name='Diesel Head';
      IF v_badge_id IS NOT NULL THEN INSERT INTO public.user_badges(user_id,badge_id) VALUES (v_user_id,v_badge_id) ON CONFLICT DO NOTHING; END IF;
    END IF;
  END IF;

  IF v_new_tier != v_old_tier THEN
    SELECT id INTO v_badge_id FROM public.badges WHERE name='Reached ' || v_new_tier::TEXT;
    IF v_badge_id IS NOT NULL THEN INSERT INTO public.user_badges(user_id,badge_id) VALUES (v_user_id,v_badge_id) ON CONFLICT DO NOTHING; END IF;
  END IF;

  -- ---- Comeback Pile maintenance (zero XP interaction) ----
  -- Misses land on the pile; a re-missed cleared tag reopens with its history.
  INSERT INTO public.comebacks (user_id, question_id, missed_count, first_missed_at, last_missed_at)
  SELECT v_user_id, q.id, 1, NOW(), NOW()
  FROM jsonb_array_elements(COALESCE(v_answers,'[]'::jsonb)) ans
  JOIN public.questions q ON q.id=(ans->>'question_id')::UUID
  WHERE NOT COALESCE((ans->>'is_correct')::BOOLEAN, FALSE)
  ON CONFLICT (user_id, question_id) DO UPDATE
    SET missed_count = public.comebacks.missed_count + 1,
        last_missed_at = NOW(),
        cleared_at = NULL;

  -- Correct answers clear any open tags: a fixed job is fixed anywhere.
  UPDATE public.comebacks c
    SET cleared_at = NOW(), cleared_count = c.cleared_count + 1
  FROM jsonb_array_elements(COALESCE(v_answers,'[]'::jsonb)) ans
  WHERE c.user_id = v_user_id AND c.cleared_at IS NULL
    AND c.question_id = (ans->>'question_id')::UUID
    AND COALESCE((ans->>'is_correct')::BOOLEAN, FALSE);

  PERFORM public.award_comeback_badges(v_user_id);

  RETURN jsonb_build_object('grade',v_grade::TEXT,'tier',v_new_tier::TEXT,'tier_up',v_new_tier!=v_old_tier,'xp_earned',v_total_xp_earned,'new_xp',v_new_xp);
END; $$;

-- ============================================================
-- 7. Backfill from full attempt history: the pile launches populated.
--    A question is open if its most recent recorded answer was wrong.
--    Only questions that still exist (migration 016 deleted some rows).
-- ============================================================
INSERT INTO public.comebacks (user_id, question_id, missed_count, cleared_count, first_missed_at, last_missed_at, cleared_at)
SELECT agg.user_id, agg.qid, agg.misses,
  CASE WHEN agg.last_right IS NOT NULL AND agg.last_right > agg.last_wrong THEN 1 ELSE 0 END,
  agg.first_wrong, agg.last_wrong,
  CASE WHEN agg.last_right IS NOT NULL AND agg.last_right > agg.last_wrong THEN agg.last_right END
FROM (
  SELECT a.user_id,
    (ans->>'question_id')::UUID AS qid,
    COUNT(*) FILTER (WHERE NOT COALESCE((ans->>'is_correct')::BOOLEAN,FALSE))::INTEGER AS misses,
    MIN(a.created_at) FILTER (WHERE NOT COALESCE((ans->>'is_correct')::BOOLEAN,FALSE)) AS first_wrong,
    MAX(a.created_at) FILTER (WHERE NOT COALESCE((ans->>'is_correct')::BOOLEAN,FALSE)) AS last_wrong,
    MAX(a.created_at) FILTER (WHERE COALESCE((ans->>'is_correct')::BOOLEAN,FALSE)) AS last_right
  FROM public.attempts a, jsonb_array_elements(COALESCE(a.answers,'[]'::jsonb)) ans
  WHERE a.completed
  GROUP BY a.user_id, (ans->>'question_id')::UUID
) agg
JOIN public.questions q ON q.id = agg.qid
WHERE agg.misses > 0
ON CONFLICT (user_id, question_id) DO NOTHING;

-- ============================================================
-- 8. Leaderboard view: adds comeback columns via correlated scalar subqueries
--    against comeback_summaries — deliberately NOT a new join, so the existing
--    SUM/COUNT aggregates can't fan out (the migration-014 bug class).
--    no_comebacks = open pile empty AND >=50 questions answered lifetime
--    (mirror of COMEBACK_STAMP_MIN_QUESTIONS in src/lib/constants.ts).
--    View has no ORDER BY (house rule) — order in the consuming query.
-- ============================================================
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
  RANK() OVER (PARTITION BY p.specialty ORDER BY p.xp DESC)::INTEGER AS specialty_rank,
  -- New columns must be APPENDED — CREATE OR REPLACE VIEW cannot reorder or
  -- rename existing columns (42P16 otherwise).
  (SELECT COUNT(*) FROM public.comeback_summaries cs WHERE cs.user_id=p.id AND cs.open)::INTEGER AS comebacks_open,
  (SELECT COALESCE(SUM(cs.cleared_count),0) FROM public.comeback_summaries cs WHERE cs.user_id=p.id)::INTEGER AS comebacks_cleared,
  ((SELECT COUNT(*) FROM public.comeback_summaries cs WHERE cs.user_id=p.id AND cs.open)=0
    AND COALESCE(SUM(a.total_questions) FILTER (WHERE a.completed),0)>=50) AS no_comebacks
FROM public.profiles p
LEFT JOIN public.user_badges ub ON ub.user_id=p.id
LEFT JOIN public.attempt_summaries a ON a.user_id=p.id
GROUP BY p.id, p.full_name, p.shop_name, p.specialty, p.xp, p.streak, p.tier;
