-- Auto-create a public.profiles row whenever a new user signs up via Supabase Auth.
-- Without this, attempts.user_id (FK -> profiles.id) fails on insert for every new user,
-- since signUp() only writes to auth.users, never to public.profiles.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for any users who signed up before this trigger existed.
INSERT INTO public.profiles (id, full_name, role, specialty, shop_name, invite_code)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', ''),
  COALESCE(NULLIF(u.raw_user_meta_data->>'role',''), 'mechanic')::public.user_role,
  COALESCE(NULLIF(u.raw_user_meta_data->>'specialty',''), 'Automotive')::public.specialty,
  COALESCE(u.raw_user_meta_data->>'shop_name', ''),
  COALESCE(u.raw_user_meta_data->>'invite_code', '')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
