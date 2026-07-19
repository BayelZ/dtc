-- 027_question_flags.sql
-- Per-question dispute flags ("this question is wrong/ambiguous"), plus an
-- is_admin gate on profiles for reviewing them. All writes go through the API
-- with the service role; RLS lets a user read only their own flags (so the
-- client can show "already disputed").

-- 1. Admin gate. No enum surgery: a plain boolean on profiles.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Both are Bayel's accounts (note the typo'd gmai.com domain on the second —
-- the canonical bayelzhumabekov@gmail.com was never registered).
UPDATE public.profiles p SET is_admin = true
FROM auth.users u
WHERE p.id = u.id AND u.email IN ('bayelzhuma@gmail.com','bayelzhumabekov@gmai.com');

-- 2. Flags table.
CREATE TABLE IF NOT EXISTS public.question_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT 'other'
    CHECK (reason IN ('wrong_answer','ambiguous','typo','other')),
  comment TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','resolved','dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (question_id, user_id)
);

CREATE INDEX IF NOT EXISTS question_flags_question_idx ON public.question_flags (question_id);
CREATE INDEX IF NOT EXISTS question_flags_status_idx ON public.question_flags (status, created_at DESC);

ALTER TABLE public.question_flags ENABLE ROW LEVEL SECURITY;

-- Users may read their own flags; all writes go through the service role.
DROP POLICY IF EXISTS question_flags_select_own ON public.question_flags;
CREATE POLICY question_flags_select_own ON public.question_flags
  FOR SELECT TO authenticated USING (user_id = auth.uid());
