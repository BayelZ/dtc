ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Client resizes/compresses to webp before upload, so only webp is accepted server-side too.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/webp'])
ON CONFLICT (id) DO UPDATE SET public=true, file_size_limit=2097152, allowed_mime_types=ARRAY['image/webp'];

-- Object name is always "{user_id}.webp" — one file per user, always overwritten (upsert), nothing orphaned.
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND name = ((SELECT auth.uid())::text || '.webp'));

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND name = ((SELECT auth.uid())::text || '.webp'))
  WITH CHECK (bucket_id = 'avatars' AND name = ((SELECT auth.uid())::text || '.webp'));

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND name = ((SELECT auth.uid())::text || '.webp'));
