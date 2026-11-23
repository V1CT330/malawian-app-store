ALTER TABLE public.listing_publication_subscriptions
  ADD COLUMN IF NOT EXISTS is_grace_period boolean NOT NULL DEFAULT false;

UPDATE public.listing_publication_subscriptions
SET is_grace_period = true
WHERE status = 'active'
  AND payment_reference IS NULL
  AND current_period_end > now();

CREATE OR REPLACE FUNCTION public.clear_publisher_grace_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_reference IS NOT NULL THEN
    NEW.is_grace_period := false;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_publisher_grace_on_payment()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS clear_publisher_grace_on_payment
  ON public.listing_publication_subscriptions;
CREATE TRIGGER clear_publisher_grace_on_payment
  BEFORE INSERT OR UPDATE OF payment_reference
  ON public.listing_publication_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_publisher_grace_on_payment();
