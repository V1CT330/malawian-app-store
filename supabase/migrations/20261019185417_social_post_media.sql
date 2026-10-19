-- Add optional image/video attachments to social posts and a dedicated, scoped storage bucket.
ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text;
ALTER TABLE public.social_posts
  DROP CONSTRAINT IF EXISTS social_posts_media_type_check;
ALTER TABLE public.social_posts
  ADD CONSTRAINT social_posts_media_type_check
  CHECK (media_type IS NULL OR media_type IN ('image', 'video'));
ALTER TABLE public.social_posts
  DROP CONSTRAINT IF EXISTS social_posts_media_pair_check;
ALTER TABLE public.social_posts
  ADD CONSTRAINT social_posts_media_pair_check
  CHECK ((media_url IS NULL AND media_type IS NULL) OR (media_url IS NOT NULL AND media_type IS NOT NULL));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'social-media',
  'social-media',
  true,
  52428800,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS social_media_upload_own_folder ON storage.objects;
CREATE POLICY social_media_upload_own_folder ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'social-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS social_media_update_own_folder ON storage.objects;
CREATE POLICY social_media_update_own_folder ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'social-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'social-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS social_media_delete_own_folder ON storage.objects;
CREATE POLICY social_media_delete_own_folder ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'social-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
