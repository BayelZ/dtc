-- 029_tree_attempts.sql — server-side scoring for diagnostic-tree runs.
-- Requires 028_diag_trees_release.sql (challenge_trees).
--
-- Additive and idempotent by design: creates ONE new table, adds ONE nullable column to the
-- new challenge_trees table, and creates ONE new function. Touches nothing that exists today —
-- not attempts, not profiles' structure, not challenges/questions, not an existing RLS policy.
--
-- Why a separate tree_attempts table rather than reusing attempts:
--   * attempts is shaped for 10 flat questions (score/total_questions/answers[]) and is read by
--     the leaderboard view and the comeback pile. A tree run has a path, a knowledge tally and a
--     binary outcome instead — overloading the column meanings would put the existing economy at
--     risk for no benefit.

-- Skill-domain mapping for trees (nullable: a case may map to no existing domain).
ALTER TABLE public.challenge_trees ADD COLUMN IF NOT EXISTS domain public.skill_domain;

COMMENT ON COLUMN public.challenge_trees.domain IS
  'Optional skill domain for domain-XP credit. NULL = general XP only (e.g. the cooling case, which maps to no current domain).';

UPDATE public.challenge_trees SET domain='Emissions'::public.skill_domain
 WHERE slug='p0420-second-opinion' AND domain IS NULL;

-- COLUMN-LEVEL HARDENING (the correct_index rule, applied to trees).
-- challenge_trees.tree holds the full DiagChallenge document INCLUDING faultSeeds — the answer
-- key: which fault is real, which test reveals it, and every seed-specific reading. The RLS
-- policy from 028 grants row SELECT, which would let any authenticated client just read that
-- column. Revoke table-wide access and grant back only the safe listing columns; the API layer
-- reads `tree` through the service role (which bypasses RLS) and only ever ships it to a browser
-- via sanitizeTreeForClient().
REVOKE ALL ON public.challenge_trees FROM anon, authenticated;
GRANT SELECT (id, slug, title, domain, is_published, created_at, updated_at)
  ON public.challenge_trees TO authenticated;

CREATE TABLE IF NOT EXISTS public.tree_attempts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tree_id         UUID NOT NULL REFERENCES public.challenge_trees(id) ON DELETE CASCADE,
  -- the fault variant the SERVER drew for this run; the client is never told it
  seed_id         TEXT NOT NULL,
  -- recorded decisions: [{"from":"intake","option":0}, ...]. Replayed server-side to score.
  steps           JSONB NOT NULL DEFAULT '[]'::jsonb,
  outcome         TEXT,           -- clean | lucky | comeback | masked
  process_score   INTEGER,        -- 0..100
  grade           public.grade,
  xp_earned       INTEGER NOT NULL DEFAULT 0,
  time_minutes    INTEGER NOT NULL DEFAULT 0,
  knowledge_correct INTEGER NOT NULL DEFAULT 0,
  knowledge_total   INTEGER NOT NULL DEFAULT 0,
  completed       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

-- Anti-farming lookup: prior completed runs of the same (user, tree, seed) pair.
CREATE INDEX IF NOT EXISTS tree_attempts_user_tree_seed_idx
  ON public.tree_attempts (user_id, tree_id, seed_id) WHERE completed = TRUE;

COMMENT ON TABLE public.tree_attempts IS
  'One diagnostic-tree run. steps[] is the recorded path; scoring is replayed server-side from it.';

ALTER TABLE public.tree_attempts ENABLE ROW LEVEL SECURITY;

-- Read-your-own only. No INSERT/UPDATE/DELETE policy: runs are created and scored exclusively
-- through the service role in the API layer, so a client can never write its own score.
DROP POLICY IF EXISTS tree_attempts_select_own ON public.tree_attempts;
CREATE POLICY tree_attempts_select_own ON public.tree_attempts
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- complete_tree_attempt: ALL variables declared at top of DECLARE block (PL/pgSQL rule).
-- Mirrors complete_attempt(): finalizes the row, credits XP, updates tier/streak and domain XP.
CREATE OR REPLACE FUNCTION public.complete_tree_attempt(
  p_attempt_id UUID, p_xp_earned INTEGER, p_outcome TEXT, p_process_score INTEGER,
  p_grade public.grade, p_time_minutes INTEGER DEFAULT 0,
  p_knowledge_correct INTEGER DEFAULT 0, p_knowledge_total INTEGER DEFAULT 0
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_user_id UUID; v_tree_id UUID; v_domain public.skill_domain;
  v_new_xp INTEGER; v_old_tier public.tier; v_new_tier public.tier; v_fixed BOOLEAN;
BEGIN
  SELECT user_id, tree_id INTO v_user_id, v_tree_id
    FROM public.tree_attempts WHERE id=p_attempt_id AND completed=FALSE FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'tree attempt % not found or already completed', p_attempt_id; END IF;
  IF p_xp_earned<0 OR p_xp_earned>2000 THEN RAISE EXCEPTION 'xp out of range: %', p_xp_earned; END IF;
  IF p_process_score<0 OR p_process_score>100 THEN RAISE EXCEPTION 'process score out of range: %', p_process_score; END IF;
  IF p_outcome NOT IN ('clean','lucky','comeback','masked') THEN RAISE EXCEPTION 'bad outcome: %', p_outcome; END IF;

  v_fixed := p_outcome IN ('clean','lucky');
  SELECT domain INTO v_domain FROM public.challenge_trees WHERE id=v_tree_id;

  UPDATE public.tree_attempts SET
    completed=TRUE, completed_at=NOW(), xp_earned=p_xp_earned, outcome=p_outcome,
    process_score=p_process_score, grade=p_grade, time_minutes=p_time_minutes,
    knowledge_correct=p_knowledge_correct, knowledge_total=p_knowledge_total
  WHERE id=p_attempt_id;

  SELECT tier INTO v_old_tier FROM public.profiles WHERE id=v_user_id;

  UPDATE public.profiles SET
    xp = xp + p_xp_earned, last_active = CURRENT_DATE,
    streak = CASE WHEN last_active=CURRENT_DATE-INTERVAL '1 day' THEN streak+1 WHEN last_active=CURRENT_DATE THEN streak ELSE 1 END,
    tier = public.xp_to_tier(xp + p_xp_earned)
  WHERE id=v_user_id RETURNING xp INTO v_new_xp;

  -- Domain XP only when the case maps to a domain, and only on a fix (a comeback teaches,
  -- but it does not certify skill in that domain).
  IF v_domain IS NOT NULL AND v_fixed THEN
    INSERT INTO public.skill_scores (user_id,domain,xp,attempts,correct)
      VALUES (v_user_id,v_domain,p_xp_earned,1,1)
    ON CONFLICT (user_id,domain) DO UPDATE SET
      xp=skill_scores.xp+p_xp_earned, attempts=skill_scores.attempts+1,
      correct=skill_scores.correct+1, updated_at=NOW();
  ELSIF v_domain IS NOT NULL THEN
    INSERT INTO public.skill_scores (user_id,domain,xp,attempts,correct)
      VALUES (v_user_id,v_domain,0,1,0)
    ON CONFLICT (user_id,domain) DO UPDATE SET
      attempts=skill_scores.attempts+1, updated_at=NOW();
  END IF;

  SELECT tier INTO v_new_tier FROM public.profiles WHERE id=v_user_id;

  RETURN jsonb_build_object(
    'new_xp', v_new_xp, 'tier', v_new_tier, 'tier_up', v_new_tier IS DISTINCT FROM v_old_tier,
    'outcome', p_outcome, 'grade', p_grade, 'xp_earned', p_xp_earned
  );
END; $$;

REVOKE ALL ON FUNCTION public.complete_tree_attempt(UUID,INTEGER,TEXT,INTEGER,public.grade,INTEGER,INTEGER,INTEGER) FROM PUBLIC, anon, authenticated;
