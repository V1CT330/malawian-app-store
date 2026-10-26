-- Enforce Developer Pro at the database boundary for product submission.
-- Developers may still create and edit drafts without a paid subscription.

CREATE OR REPLACE FUNCTION public.is_pro(_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
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

CREATE OR REPLACE FUNCTION public.require_pro_for_listing_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin boolean := public.has_role(auth.uid(), 'admin');
  _auto_publish boolean := COALESCE(current_setting('app.auto_publish', true), 'off') = 'on';
BEGIN
  IF _admin THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
    AND (
      (OLD.status = 'draft' AND NEW.status = 'pending')
      OR (_auto_publish AND NEW.status = 'published' AND OLD.status IN ('draft', 'rejected'))
    )
    AND NOT public.is_pro(auth.uid()) THEN
    RAISE EXCEPTION 'Developer Pro subscription required to submit or publish products. Manage your plan in the Developer Console.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a_require_pro_for_listing_submission ON public.listings;
CREATE TRIGGER a_require_pro_for_listing_submission
  BEFORE UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.require_pro_for_listing_submission();
