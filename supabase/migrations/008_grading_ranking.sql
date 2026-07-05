DO $$ BEGIN CREATE TYPE public.grade AS ENUM ('A','B','C','F'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS grade public.grade,
  ADD COLUMN IF NOT EXISTS speed_bonus_xp INTEGER NOT NULL DEFAULT 0 CHECK (speed_bonus_xp>=0),
  ADD COLUMN IF NOT EXISTS time_seconds INTEGER NOT NULL DEFAULT 0 CHECK (time_seconds>=0);

DO $$ BEGIN CREATE TYPE public.tier AS ENUM ('Bronze','Silver','Gold','Platinum','Master'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tier public.tier NOT NULL DEFAULT 'Bronze';

DO $$ BEGIN CREATE TYPE public.skill_domain AS ENUM ('Electrical','Fuel','Emissions','Drivetrain','Network'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.skill_scores (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  domain public.skill_domain NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp>=0),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts>=0),
  correct INTEGER NOT NULL DEFAULT 0 CHECK (correct>=0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (user_id,domain)
);
ALTER TABLE public.skill_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "skill_scores_select" ON public.skill_scores;
CREATE POLICY "skill_scores_select" ON public.skill_scores FOR SELECT TO authenticated USING (TRUE);
CREATE INDEX IF NOT EXISTS idx_skill_scores_user_id ON public.skill_scores(user_id);

CREATE TABLE IF NOT EXISTS public.challenge_domains (
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE PRIMARY KEY,
  domain public.skill_domain NOT NULL
);
ALTER TABLE public.challenge_domains ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "challenge_domains_select" ON public.challenge_domains;
CREATE POLICY "challenge_domains_select" ON public.challenge_domains FOR SELECT TO authenticated USING (TRUE);

INSERT INTO public.challenge_domains (challenge_id,domain) SELECT id,'Fuel'::public.skill_domain FROM public.challenges WHERE slug='p0171-lean-bank1' ON CONFLICT DO NOTHING;
INSERT INTO public.challenge_domains (challenge_id,domain) SELECT id,'Electrical'::public.skill_domain FROM public.challenges WHERE slug='lh-low-beam-open' ON CONFLICT DO NOTHING;
INSERT INTO public.challenge_domains (challenge_id,domain) SELECT id,'Emissions'::public.skill_domain FROM public.challenges WHERE slug='p0401-egr-flow' ON CONFLICT DO NOTHING;
INSERT INTO public.challenge_domains (challenge_id,domain) SELECT id,'Fuel'::public.skill_domain FROM public.challenges WHERE slug='6-7-balance-rates' ON CONFLICT DO NOTHING;
INSERT INTO public.challenge_domains (challenge_id,domain) SELECT id,'Electrical'::public.skill_domain FROM public.challenges WHERE slug='voltage-drop-no-crank' ON CONFLICT DO NOTHING;
INSERT INTO public.challenge_domains (challenge_id,domain) SELECT id,'Fuel'::public.skill_domain FROM public.challenges WHERE slug='p0300-misfire-accord' ON CONFLICT DO NOTHING;
INSERT INTO public.challenge_domains (challenge_id,domain) SELECT id,'Electrical'::public.skill_domain FROM public.challenges WHERE slug='alternator-charging' ON CONFLICT DO NOTHING;
INSERT INTO public.challenge_domains (challenge_id,domain) SELECT id,'Network'::public.skill_domain FROM public.challenges WHERE slug='can-bus-u-codes-ram' ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.xp_to_tier(p_xp INTEGER) RETURNS public.tier LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN CASE WHEN p_xp>=10000 THEN 'Master'::public.tier WHEN p_xp>=5000 THEN 'Platinum'::public.tier
    WHEN p_xp>=2500 THEN 'Gold'::public.tier WHEN p_xp>=1000 THEN 'Silver'::public.tier ELSE 'Bronze'::public.tier END;
END; $$;

CREATE OR REPLACE FUNCTION public.score_to_grade(p_score INTEGER, p_total INTEGER) RETURNS public.grade LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p_total=0 THEN RETURN 'F'::public.grade; END IF;
  RETURN CASE WHEN p_score=p_total THEN 'A'::public.grade WHEN p_score>=CEIL(p_total*0.66) THEN 'B'::public.grade
    WHEN p_score>=CEIL(p_total*0.33) THEN 'C'::public.grade ELSE 'F'::public.grade END;
END; $$;

-- Note: ORDER BY intentionally omitted from the view — not guaranteed by Postgres in views.
-- The consuming query (leaderboard.tsx / shop.tsx) applies .order("xp",{ascending:false}).
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
LEFT JOIN public.attempts a ON a.user_id=p.id
GROUP BY p.id, p.full_name, p.shop_name, p.specialty, p.xp, p.streak, p.tier;

-- complete_attempt: ALL variables declared at top of DECLARE block (PL/pgSQL rule — no mid-body DECLARE)
CREATE OR REPLACE FUNCTION public.complete_attempt(
  p_attempt_id UUID, p_xp_earned INTEGER, p_speed_bonus INTEGER DEFAULT 0, p_time_seconds INTEGER DEFAULT 0
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_user_id UUID; v_score INTEGER; v_total INTEGER; v_challenge_id UUID;
  v_specialty TEXT; v_domain public.skill_domain; v_grade public.grade;
  v_badge_id UUID; v_completed_count BIGINT; v_streak INTEGER; v_diesel_count BIGINT;
  v_new_xp INTEGER; v_old_tier public.tier; v_new_tier public.tier; v_total_xp_earned INTEGER;
BEGIN
  SELECT user_id, score, total_questions, challenge_id INTO v_user_id, v_score, v_total, v_challenge_id
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

  RETURN jsonb_build_object('grade',v_grade::TEXT,'tier',v_new_tier::TEXT,'tier_up',v_new_tier!=v_old_tier,'xp_earned',v_total_xp_earned,'new_xp',v_new_xp);
END; $$;

INSERT INTO public.badges (name,description,icon,criteria) VALUES
  ('Reached Silver','Hit Silver tier — 1,000 XP','🥈','{"tier":"Silver"}'),
  ('Reached Gold','Hit Gold tier — 2,500 XP','🥇','{"tier":"Gold"}'),
  ('Reached Platinum','Hit Platinum tier — 5,000 XP','💎','{"tier":"Platinum"}'),
  ('Reached Master','Hit Master tier — 10,000 XP','👑','{"tier":"Master"}')
ON CONFLICT (name) DO NOTHING;

UPDATE public.profiles SET tier = public.xp_to_tier(xp) WHERE tier IS DISTINCT FROM public.xp_to_tier(xp);
