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
