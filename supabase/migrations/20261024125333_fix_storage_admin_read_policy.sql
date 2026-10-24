-- Keep anonymous storage reads independent of admin-only function permissions.
DROP POLICY IF EXISTS app_assets_read_published_assets ON storage.objects;
CREATE POLICY app_assets_read_published_assets
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'app-assets'
    AND (
      (storage.foldername(name))[1] = (select auth.uid())::text
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

DROP POLICY IF EXISTS app_assets_read_admin ON storage.objects;
CREATE POLICY app_assets_read_admin
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'app-assets'
    AND public.has_role((select auth.uid()), 'admin')
  );
