-- Storage configuration and administrator release review for app distribution.
-- Keep app assets private; downloads use short-lived signed URLs from the client.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'app-assets',
  'app-assets',
  false,
  52428800,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
    'application/vnd.android.package-archive',
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO UPDATE
SET file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- A public SELECT policy on the whole bucket would let anonymous users mint
-- signed URLs for unreleased packages. Restrict reads to owners/admins and assets
-- referenced by published listings or public profile avatars.
DROP POLICY IF EXISTS app_assets_read_all ON storage.objects;
CREATE POLICY app_assets_read_published_assets
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'app-assets'
    AND (
      (storage.foldername(name))[1] = (select auth.uid())::text
      OR public.has_role((select auth.uid()), 'admin')
      OR EXISTS (
        SELECT 1
        FROM public.listings l
        WHERE l.status = 'published'
          AND (
            l.icon_url = storage.objects.name
            OR l.banner_url = storage.objects.name
            OR l.video_url = storage.objects.name
            OR storage.objects.name = ANY(l.screenshots)
            OR storage.objects.name = ANY(l.promo_images)
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.listing_versions v
        JOIN public.listings l ON l.id = v.listing_id
        WHERE v.file_url = storage.objects.name
          AND v.status IN ('released', 'published')
          AND l.status = 'published'
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.avatar_url = storage.objects.name
      )
    )
  );

-- Administrators must be able to inspect and decide pending release packages.
DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'listing_versions'
      AND policyname = 'versions_admin_all'
  ) THEN
    CREATE POLICY versions_admin_all
      ON public.listing_versions
      FOR ALL
      TO authenticated
      USING (public.has_role((select auth.uid()), 'admin'))
      WITH CHECK (public.has_role((select auth.uid()), 'admin'));
  END IF;
END
$policy$;
