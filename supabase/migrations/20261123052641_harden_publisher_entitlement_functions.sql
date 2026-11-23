CREATE OR REPLACE FUNCTION private.has_listing_publication_access(_developer uuid, _listing uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.listing_publication_subscriptions p
    WHERE p.listing_id = _listing AND p.developer_id = _developer
      AND p.status = 'active' AND p.current_period_end > now()
  )
  OR EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = _developer AND s.plan = 'pro'
      AND s.status IN ('active', 'cancelled', 'trialing')
      AND s.current_period_end > now() AND s.included_listing_id = _listing
  );
$$;

GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_listing_publication_access(uuid, uuid)
  TO anon, authenticated, service_role;

DROP POLICY IF EXISTS listings_public_read ON public.listings;
CREATE POLICY listings_public_read ON public.listings
  FOR SELECT TO anon, authenticated
  USING (status = 'published' AND private.has_listing_publication_access(developer_id, id));

REVOKE ALL ON FUNCTION public.has_listing_publication_access(uuid, uuid) FROM PUBLIC, anon, authenticated;
DROP FUNCTION public.has_listing_publication_access(uuid, uuid);

REVOKE ALL ON FUNCTION public.require_listing_publication_entitlement() FROM PUBLIC, anon, authenticated;
