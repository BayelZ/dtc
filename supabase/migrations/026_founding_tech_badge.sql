-- 026_founding_tech_badge.sql
-- The Founding Tech badge, promised in the Houston beta ads: every account
-- created during the beta window carries it permanently. Awarded two ways:
--   1. Backfill: every existing profile (they all predate public launch).
--   2. Trigger: handle_new_user() awards it to each new signup — the whole
--      open-signup era IS the beta, so no cohort test is needed; ending the
--      beta means shipping a migration that removes the award block below
--      (see the WHEN BETA ENDS note).

INSERT INTO public.badges (name,description,icon,criteria) VALUES
  ('Founding Tech','Signed up during the Houston beta — here before the paint dried','🏁','{"cohort":"houston-beta"}')
ON CONFLICT (name) DO NOTHING;

-- Trigger update: profile creation also awards the badge.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_badge_id UUID;
BEGIN
  INSERT INTO public.profiles (id, full_name, role, specialty, shop_name, invite_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'role',''), 'mechanic')::public.user_role,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'specialty',''), 'Automotive')::public.specialty,
    COALESCE(NEW.raw_user_meta_data->>'shop_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'invite_code', '')
  )
  ON CONFLICT (id) DO NOTHING;

  -- WHEN BETA ENDS: delete this block in the beta-close migration so
  -- post-beta signups stop receiving Founding Tech.
  SELECT id INTO v_badge_id FROM public.badges WHERE name='Founding Tech';
  IF v_badge_id IS NOT NULL THEN
    INSERT INTO public.user_badges(user_id, badge_id) VALUES (NEW.id, v_badge_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill: everyone already here was here before launch.
INSERT INTO public.user_badges (user_id, badge_id)
SELECT p.id, b.id
FROM public.profiles p, public.badges b
WHERE b.name='Founding Tech'
ON CONFLICT DO NOTHING;
