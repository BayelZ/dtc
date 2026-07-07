-- Avatar uploads now go through /api/profile/avatar, which validates the file
-- (WebP magic bytes, size cap) server-side before writing via the admin client.
-- Direct client writes to storage.objects bypassed that validation entirely —
-- a client could hit the Storage REST API directly with a spoofed Content-Type
-- and arbitrary bytes, since the old INSERT/UPDATE policies only checked the
-- object path, not the actual file content. Drop them; public read stays.
DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
