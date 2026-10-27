-- Keep subscription authorization helpers internal. Trigger functions should not
-- be callable directly through the public Data API, and users must not be able
-- to probe another account's Pro status by passing an arbitrary UUID.

CREATE OR REPLACE FUNCTION public.is_pro(_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() = _user AND EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.user_id = _user
      AND (
        (s.status = 'active'
          AND (s.current_period_end IS NULL OR s.current_period_end > now()))
        OR
        (s.status = 'cancelled'
          AND s.current_period_end IS NOT NULL
          AND s.current_period_end > now())
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_pro(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.require_pro_for_listing_submission() FROM PUBLIC, anon, authenticated;
