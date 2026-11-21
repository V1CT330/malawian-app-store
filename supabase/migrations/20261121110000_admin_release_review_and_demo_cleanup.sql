-- Give the explicit MAS admin role the read/update permissions required
-- for release moderation. UPDATE also requires a matching SELECT policy.
CREATE POLICY listing_versions_admin_read
ON public.listing_versions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY listing_versions_admin_update
ON public.listing_versions
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Remove only the eight fictional catalogue rows seeded by the original demo
-- migration. Their linked view/install events are demo telemetry and cascade
-- with the listing deletion. Real users, profiles, submissions and payments
-- are not selected by these immutable synthetic developer IDs + slugs.
DELETE FROM public.listings
WHERE (developer_id, slug) IN (
  ('11111111-1111-4111-8111-111111111101'::uuid, 'mzuni-notes'),
  ('11111111-1111-4111-8111-111111111102'::uuid, 'malipo-pay'),
  ('11111111-1111-4111-8111-111111111103'::uuid, 'nyasa-news'),
  ('11111111-1111-4111-8111-111111111104'::uuid, 'chigwirizano-market'),
  ('11111111-1111-4111-8111-111111111105'::uuid, 'moyo-health'),
  ('11111111-1111-4111-8111-111111111106'::uuid, 'tili-transport'),
  ('11111111-1111-4111-8111-111111111107'::uuid, 'kwacha-books'),
  ('11111111-1111-4111-8111-111111111108'::uuid, 'warm-heart-tours')
);
