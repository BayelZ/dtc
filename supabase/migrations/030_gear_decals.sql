-- 030_gear_decals.sql — earned profile decals ("gear").
--
-- Additive and idempotent. Creates three new tables, two new functions, and seeds a catalog.
-- Touches NOTHING that exists: not profiles' structure, not attempts, not complete_attempt,
-- not challenges/questions, not an existing RLS policy.
--
-- DESIGN RULE THAT DRIVES EVERYTHING HERE: **XP is never spent.**
-- Decals unlock against state the tech has already earned. If buying a decal deducted XP, a
-- tech could drop a tier (xp_to_tier) and lose leaderboard rank by decorating their profile —
-- and the number a shop owner reads in the hiring portal would stop meaning "skill".
-- Every rule below is a threshold or membership test. None of them subtract anything.
--
-- Rules live in JSONB and are EVALUATED (unlike badges.criteria, which is decorative — badge
-- awards are hardcoded in complete_attempt). Adding a decal here is an INSERT, not a deploy.

-- ---------------------------------------------------------------------------
-- Grade ordering helper. A > B > C > F. Needed by grade-qualified unlock rules
-- ("clear this challenge at a B or better").
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grade_rank(p_grade public.grade)
RETURNS INTEGER LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_grade WHEN 'A' THEN 3 WHEN 'B' THEN 2 WHEN 'C' THEN 1 ELSE 0 END;
$$;

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cosmetics (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  -- shown on the LOCKED card — write it as an instruction; this is the quest hook
  requirement  TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('oval','patch','shield','stamp')),
  rarity       TEXT NOT NULL CHECK (rarity IN ('standard','earned','rare')),
  legend       TEXT NOT NULL CHECK (char_length(legend) <= 6),
  color        TEXT NOT NULL,
  unlock_rule  JSONB NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 100,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.cosmetics IS
  'Earned profile decals. unlock_rule is evaluated server-side by grant_cosmetics(); nothing here is purchasable.';

-- ---------------------------------------------------------------------------
-- Ownership (earned) and loadout (equipped)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_cosmetics (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cosmetic_id UUID NOT NULL REFERENCES public.cosmetics(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, cosmetic_id)
);

CREATE TABLE IF NOT EXISTS public.profile_loadout (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot        SMALLINT NOT NULL CHECK (slot BETWEEN 0 AND 3),   -- 4 slots; scarcity is the point
  cosmetic_id UUID NOT NULL,
  PRIMARY KEY (user_id, slot),
  -- You cannot equip a decal you do not own. Enforced by the DATABASE, not just the API:
  -- the composite FK means an unowned cosmetic_id has no matching ownership row.
  CONSTRAINT profile_loadout_owned_fk
    FOREIGN KEY (user_id, cosmetic_id) REFERENCES public.user_cosmetics(user_id, cosmetic_id) ON DELETE CASCADE,
  -- and the same decal can't occupy two slots
  UNIQUE (user_id, cosmetic_id)
);

-- ---------------------------------------------------------------------------
-- RLS. Catalog is public to authenticated (it's the "what can I earn" list, and the
-- requirement text is meant to be seen). Ownership/loadout are read-your-own; a profile
-- someone else views is served through the API, not by direct table reads.
-- Writes happen exclusively via the service role, so a client can never grant itself a decal.
-- ---------------------------------------------------------------------------
ALTER TABLE public.cosmetics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_cosmetics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_loadout ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cosmetics_select ON public.cosmetics;
CREATE POLICY cosmetics_select ON public.cosmetics
  FOR SELECT TO authenticated USING (is_active = TRUE);

DROP POLICY IF EXISTS user_cosmetics_select_own ON public.user_cosmetics;
CREATE POLICY user_cosmetics_select_own ON public.user_cosmetics
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Loadout is readable by any authenticated user: decals are meant to be seen on a public
-- profile. Only the owner can ever WRITE, and writes go through the service role anyway.
DROP POLICY IF EXISTS profile_loadout_select ON public.profile_loadout;
CREATE POLICY profile_loadout_select ON public.profile_loadout
  FOR SELECT TO authenticated USING (TRUE);

-- ---------------------------------------------------------------------------
-- grant_cosmetics: evaluate every active rule for one user and grant what they've earned.
-- IDEMPOTENT — safe to call after any attempt, and it doubles as the backfill when a new
-- decal is added later (a push-only design would leave already-qualified users empty-handed).
-- Returns only the NEWLY granted rows so the UI can celebrate them.
-- ALL variables declared at the top of the DECLARE block (PL/pgSQL house rule).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_cosmetics(p_user_id UUID)
RETURNS TABLE(slug TEXT, name TEXT) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_xp INTEGER; v_invite TEXT; v_open_comebacks INTEGER; v_questions INTEGER;
  v_rec RECORD; v_rule JSONB; v_ok BOOLEAN;
BEGIN
  SELECT p.xp, p.invite_code INTO v_xp, v_invite FROM public.profiles p WHERE p.id = p_user_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(SUM(a.total_questions) FILTER (WHERE a.completed), 0)
    INTO v_questions FROM public.attempts a WHERE a.user_id = p_user_id;
  SELECT COUNT(*) INTO v_open_comebacks
    FROM public.comeback_summaries cs WHERE cs.user_id = p_user_id AND cs.open;

  FOR v_rec IN
    SELECT c.id, c.slug, c.name, c.unlock_rule FROM public.cosmetics c
     WHERE c.is_active
       AND NOT EXISTS (SELECT 1 FROM public.user_cosmetics uc
                        WHERE uc.user_id = p_user_id AND uc.cosmetic_id = c.id)
  LOOP
    v_rule := v_rec.unlock_rule;
    v_ok := CASE v_rule->>'type'

      WHEN 'cohort' THEN
        v_invite = (v_rule->>'value')

      WHEN 'xp_at_least' THEN
        v_xp >= (v_rule->>'value')::INTEGER

      WHEN 'tier_at_least' THEN
        -- compare by XP floor so this stays in lockstep with xp_to_tier()
        v_xp >= CASE v_rule->>'value'
                  WHEN 'Silver' THEN 1000 WHEN 'Gold' THEN 2500
                  WHEN 'Platinum' THEN 5000 WHEN 'Master' THEN 10000 ELSE 0 END

      WHEN 'domain_xp_at_least' THEN
        COALESCE((SELECT ss.xp FROM public.skill_scores ss
                   WHERE ss.user_id = p_user_id
                     AND ss.domain = (v_rule->>'domain')::public.skill_domain), 0)
        >= (v_rule->>'value')::INTEGER

      WHEN 'grade_count' THEN
        (SELECT COUNT(*) FROM public.attempts a
          WHERE a.user_id = p_user_id AND a.completed
            AND a.grade = (v_rule->>'grade')::public.grade) >= (v_rule->>'value')::INTEGER

      -- "clear THIS challenge at a B or better"
      WHEN 'challenge_grade' THEN
        EXISTS (SELECT 1 FROM public.attempts a
                  JOIN public.challenges ch ON ch.id = a.challenge_id
                 WHERE a.user_id = p_user_id AND a.completed
                   AND ch.slug = (v_rule->>'slug')
                   AND public.grade_rank(a.grade)
                       >= public.grade_rank((v_rule->>'min_grade')::public.grade))

      -- "fix THIS diagnostic case cleanly" (a lucky part-swap does not count)
      WHEN 'tree_outcome' THEN
        EXISTS (SELECT 1 FROM public.tree_attempts ta
                  JOIN public.challenge_trees ct ON ct.id = ta.tree_id
                 WHERE ta.user_id = p_user_id AND ta.completed
                   AND ct.slug = (v_rule->>'slug')
                   AND ta.outcome = COALESCE(v_rule->>'outcome','clean'))

      WHEN 'comebacks_clean' THEN
        v_open_comebacks = 0 AND v_questions >= 50

      ELSE FALSE
    END;

    IF v_ok THEN
      INSERT INTO public.user_cosmetics (user_id, cosmetic_id)
        VALUES (p_user_id, v_rec.id) ON CONFLICT DO NOTHING;
      slug := v_rec.slug; name := v_rec.name; RETURN NEXT;
    END IF;
  END LOOP;
END; $$;

REVOKE ALL ON FUNCTION public.grant_cosmetics(UUID) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- set_profile_loadout: replace a user's whole box atomically.
-- Ownership is re-checked here even though the composite FK would also reject an unowned
-- decal — this way the caller gets a clear error instead of a constraint violation.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_profile_loadout(p_user_id UUID, p_slugs TEXT[])
RETURNS TABLE(slug TEXT) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_max_slots CONSTANT INTEGER := 4;
  v_ids UUID[]; v_i INTEGER; v_id UUID; v_slug TEXT;
BEGIN
  IF array_length(p_slugs,1) > v_max_slots THEN
    RAISE EXCEPTION 'too many decals: % (max %)', array_length(p_slugs,1), v_max_slots;
  END IF;

  -- resolve slugs -> ids, verifying ownership as we go
  v_ids := ARRAY[]::UUID[];
  IF p_slugs IS NOT NULL THEN
    FOREACH v_slug IN ARRAY p_slugs LOOP
      SELECT c.id INTO v_id FROM public.cosmetics c
        JOIN public.user_cosmetics uc ON uc.cosmetic_id = c.id AND uc.user_id = p_user_id
       WHERE c.slug = v_slug AND c.is_active;
      IF v_id IS NULL THEN RAISE EXCEPTION 'decal % is not unlocked for this user', v_slug; END IF;
      IF v_id = ANY(v_ids) THEN RAISE EXCEPTION 'duplicate decal: %', v_slug; END IF;
      v_ids := array_append(v_ids, v_id);
    END LOOP;
  END IF;

  DELETE FROM public.profile_loadout pl WHERE pl.user_id = p_user_id;

  v_i := 0;
  FOREACH v_id IN ARRAY v_ids LOOP
    INSERT INTO public.profile_loadout (user_id, slot, cosmetic_id) VALUES (p_user_id, v_i, v_id);
    v_i := v_i + 1;
  END LOOP;

  RETURN QUERY
    SELECT c.slug FROM public.profile_loadout pl
      JOIN public.cosmetics c ON c.id = pl.cosmetic_id
     WHERE pl.user_id = p_user_id ORDER BY pl.slot;
END; $$;

REVOKE ALL ON FUNCTION public.set_profile_loadout(UUID, TEXT[]) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Catalog seed. Ported from the prototype in src/lib/gear/catalog.ts.
-- ON CONFLICT DO UPDATE so re-running this migration re-syncs copy/art tweaks.
-- ---------------------------------------------------------------------------
INSERT INTO public.cosmetics (slug,name,requirement,kind,rarity,legend,color,unlock_rule,sort_order) VALUES
  ('founding-tech','Founding Tech','Sign up during the Houston beta','patch','rare','HTX 26','var(--accent)','{"type":"cohort","value":"HOUSTON-BETA"}',10),
  ('first-thousand','Four Digits','Reach 1,000 XP','oval','standard','1K','var(--text-muted)','{"type":"xp_at_least","value":1000}',20),
  ('gold-tier','Gold Tier','Reach Gold tier — 2,500 XP','shield','earned','GOLD','#EF9F27','{"type":"tier_at_least","value":"Gold"}',30),
  ('master-tier','Master Tier','Reach Master tier — 10,000 XP','shield','rare','MSTR','var(--accent)','{"type":"tier_at_least","value":"Master"}',40),
  ('sixty-ohm','Sixty Ohm','Earn 500 XP in the Network domain','oval','earned','60Ω','#2BB8A8','{"type":"domain_xp_at_least","domain":"Network","value":500}',50),
  ('sparky','Sparky','Earn 500 XP in the Electrical domain','oval','earned','VOLTS','#EFD027','{"type":"domain_xp_at_least","domain":"Electrical","value":500}',60),
  ('cat-whisperer','Cat Whisperer','Clear the P0420 case without condemning the converter','patch','rare','P0420','#9B7FE8','{"type":"tree_outcome","slug":"p0420-second-opinion","outcome":"clean"}',70),
  ('block-test','Proved It','Clear the head-gasket case with a clean diagnosis','patch','rare','PROVED','#2BB8A8','{"type":"tree_outcome","slug":"cooling-second-opinion","outcome":"clean"}',80),
  ('no-comebacks','No Comebacks','Empty the Rework Bench with 50+ questions answered','stamp','rare','NO CB','#E9EEF2','{"type":"comebacks_clean"}',90),
  ('straight-a','Straight A','Finish ten challenges at grade A','shield','earned','AAA','var(--good)','{"type":"grade_count","grade":"A","value":10}',100),
  ('parasitic-draw','Draw Hunter','Clear the parasitic-draw challenge at a B or better','oval','earned','mA','#9B7FE8','{"type":"challenge_grade","slug":"parasitic-draw-tahoe","min_grade":"B"}',110),
  ('bus-master','Bus Master','Clear the U0101 no-comm challenge at an A','patch','rare','CAN H','#2BB8A8','{"type":"challenge_grade","slug":"u0101-no-comm-tcm","min_grade":"A"}',120)
ON CONFLICT (slug) DO UPDATE SET
  name=EXCLUDED.name, requirement=EXCLUDED.requirement, kind=EXCLUDED.kind, rarity=EXCLUDED.rarity,
  legend=EXCLUDED.legend, color=EXCLUDED.color, unlock_rule=EXCLUDED.unlock_rule, sort_order=EXCLUDED.sort_order;
