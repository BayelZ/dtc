CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.invite_codes (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count>=0),
  max_uses INTEGER NOT NULL DEFAULT 100 CHECK (max_uses>0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invite_codes_select" ON public.invite_codes;
CREATE POLICY "invite_codes_select" ON public.invite_codes FOR SELECT TO anon, authenticated USING (is_active=TRUE);
INSERT INTO public.invite_codes (code,max_uses) VALUES ('BAYEL',500),('ZHU',500) ON CONFLICT (code) DO NOTHING;

DO $$ BEGIN CREATE TYPE public.user_role AS ENUM ('mechanic','student','shop_owner'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.specialty AS ENUM ('Automotive','Diesel','Both'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL DEFAULT '' CHECK (char_length(full_name)<=80),
  role public.user_role NOT NULL DEFAULT 'mechanic',
  specialty public.specialty NOT NULL DEFAULT 'Automotive',
  shop_name TEXT NOT NULL DEFAULT '' CHECK (char_length(shop_name)<=100),
  city TEXT NOT NULL DEFAULT 'Houston',
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp>=0),
  streak INTEGER NOT NULL DEFAULT 0 CHECK (streak>=0),
  last_active DATE, invite_code TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_trigger" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING ((SELECT auth.uid())=id) WITH CHECK ((SELECT auth.uid())=id);
CREATE POLICY "profiles_insert_trigger" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid())=id);

DO $$ BEGIN CREATE TYPE public.challenge_type AS ENUM ('dtc','wiring','component','ro'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.difficulty AS ENUM ('Easy','Medium','Hard'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.challenges (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9\-]+$' AND char_length(slug) BETWEEN 3 AND 80),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  type public.challenge_type NOT NULL, specialty public.specialty NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 100 CHECK (xp_reward BETWEEN 1 AND 1000),
  description TEXT NOT NULL DEFAULT '', tags TEXT[] NOT NULL DEFAULT '{}',
  is_published BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "challenges_select_published" ON public.challenges;
CREATE POLICY "challenges_select_published" ON public.challenges FOR SELECT TO authenticated USING (is_published=TRUE);
CREATE INDEX IF NOT EXISTS idx_challenges_specialty ON public.challenges(specialty);
CREATE INDEX IF NOT EXISTS idx_challenges_type ON public.challenges(type);

CREATE TABLE IF NOT EXISTS public.questions (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  difficulty public.difficulty NOT NULL, tier_order INTEGER NOT NULL CHECK (tier_order BETWEEN 0 AND 2),
  question_text TEXT NOT NULL CHECK (char_length(question_text)>=10),
  options JSONB NOT NULL, correct_index INTEGER NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  explanation TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (challenge_id, tier_order)
);
ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS options_is_array_of_4;
ALTER TABLE public.questions ADD CONSTRAINT options_is_array_of_4 CHECK (jsonb_typeof(options)='array' AND jsonb_array_length(options)=4);
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "questions_select" ON public.questions;
CREATE POLICY "questions_select" ON public.questions FOR SELECT TO authenticated USING (TRUE);
CREATE INDEX IF NOT EXISTS idx_questions_challenge_id ON public.questions(challenge_id);
CREATE INDEX IF NOT EXISTS idx_questions_tier ON public.questions(challenge_id,tier_order);

CREATE TABLE IF NOT EXISTS public.attempts (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0 CHECK (score>=0),
  total_questions INTEGER NOT NULL DEFAULT 3 CHECK (total_questions>0),
  xp_earned INTEGER NOT NULL DEFAULT 0 CHECK (xp_earned>=0),
  answers JSONB NOT NULL DEFAULT '[]', completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "attempts_select_own" ON public.attempts;
DROP POLICY IF EXISTS "attempts_insert_own" ON public.attempts;
CREATE POLICY "attempts_select_own" ON public.attempts FOR SELECT TO authenticated USING ((SELECT auth.uid())=user_id);
CREATE POLICY "attempts_insert_own" ON public.attempts FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid())=user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON public.attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_challenge_id ON public.attempts(challenge_id);

CREATE TABLE IF NOT EXISTS public.badges (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY, name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '', icon TEXT NOT NULL DEFAULT '', criteria JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "badges_select" ON public.badges;
CREATE POLICY "badges_select" ON public.badges FOR SELECT TO authenticated USING (TRUE);
INSERT INTO public.badges (name,description,icon,criteria) VALUES
  ('First Start','Complete your first challenge','🔧','{"challenges_completed":1}'),
  ('Perfect Run','Score 3/3 on any challenge','🏆','{"perfect_score":true}'),
  ('Streak Week','Maintain a 7-day streak','🔥','{"streak":7}'),
  ('Diesel Head','Complete 10 diesel challenges','🛢','{"specialty":"Diesel","count":10}')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.user_badges (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (user_id,badge_id)
);
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_badges_select_own" ON public.user_badges;
DROP POLICY IF EXISTS "user_badges_insert_own" ON public.user_badges;
CREATE POLICY "user_badges_select_own" ON public.user_badges FOR SELECT TO authenticated USING ((SELECT auth.uid())=user_id);
CREATE POLICY "user_badges_insert_own" ON public.user_badges FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid())=user_id);
