-- Prevent listing owners from bypassing the store review workflow through direct API updates.
-- Admin reviewers and trusted server-side service-role operations may publish listings.
CREATE OR REPLACE FUNCTION public.guard_listing_publication()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'published'
     AND OLD.status IS DISTINCT FROM 'published'
     AND COALESCE(auth.role(), '') <> 'service_role'
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'A store administrator must approve this listing before publication.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_listing_publication ON public.listings;
CREATE TRIGGER guard_listing_publication
BEFORE UPDATE OF status ON public.listings
FOR EACH ROW
EXECUTE FUNCTION public.guard_listing_publication();
