-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)

-- 1. Add photo column to session_devices
ALTER TABLE session_devices ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 2. Create storage bucket (public so URLs work without expiry)
INSERT INTO storage.buckets (id, name, public)
VALUES ('patch-photos', 'patch-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS policies — each user can only touch their own folder
CREATE POLICY "patch_photos_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'patch-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "patch_photos_select"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'patch-photos');

CREATE POLICY "patch_photos_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'patch-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
