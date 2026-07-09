-- Migration 015's dynamic constraint-drop searched for any CHECK constraint
-- whose definition mentioned 'tier_order', intending to only catch the old
-- `tier_order BETWEEN 0 AND 2` check. But that ILIKE pattern also matched
-- the table's UNIQUE(challenge_id, tier_order) constraint's definition, so
-- it got dropped as collateral damage. Without it, subsequent inserts had
-- no duplicate protection, producing 104 duplicate rows across 80
-- (challenge_id, tier_order) pairs.
--
-- Remove the duplicates, keeping the earliest row per (challenge_id,
-- tier_order) pair, then restore the missing unique constraint.
DELETE FROM public.questions q
USING public.questions q2
WHERE q.challenge_id = q2.challenge_id
  AND q.tier_order = q2.tier_order
  AND (q.created_at, q.id) > (q2.created_at, q2.id);

ALTER TABLE public.questions
  ADD CONSTRAINT questions_challenge_id_tier_order_key UNIQUE (challenge_id, tier_order);
