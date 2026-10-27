-- Complete MAS sponsored placements: approval, prepaid budgets, and event tracking.
ALTER TABLE public.promotions
  ALTER COLUMN status SET DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS cost_per_click_mwk integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS duration_days integer NOT NULL DEFAULT 7;

-- Existing campaigns were not verified as paid; do not serve them automatically.
UPDATE public.promotions
SET status = 'pending', payment_status = 'unpaid'
WHERE status = 'active';

ALTER TABLE public.promotions
  DROP CONSTRAINT IF EXISTS promotions_payment_status_check,
  ADD CONSTRAINT promotions_payment_status_check
    CHECK (payment_status IN ('unpaid', 'paid', 'refunded'));

CREATE TABLE IF NOT EXISTS public.promotion_events (
  id uuid PRIMARY KEY,
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('impression', 'click')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS promotion_events_campaign_created_idx
  ON public.promotion_events (promotion_id, created_at DESC);
ALTER TABLE public.promotion_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.promotion_events FROM anon, authenticated;
GRANT ALL ON public.promotion_events TO service_role;

DROP POLICY IF EXISTS promotions_public_read ON public.promotions;
DROP POLICY IF EXISTS promotions_owner_all ON public.promotions;
CREATE POLICY promotions_live_public_read ON public.promotions
  FOR SELECT TO anon, authenticated
  USING (
    status = 'active'
    AND payment_status = 'paid'
    AND starts_at <= now()
    AND (ends_at IS NULL OR ends_at > now())
  );
CREATE POLICY promotions_owner_read ON public.promotions
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY promotions_admin_read ON public.promotions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY promotions_owner_insert ON public.promotions
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND status = 'pending'
    AND payment_status = 'unpaid'
  );
CREATE POLICY promotions_owner_pause ON public.promotions
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid() AND status = 'paused');
CREATE POLICY promotions_admin_update ON public.promotions
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.guard_promotion_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.owner_id <> auth.uid() OR NEW.status <> 'pending' OR NEW.payment_status <> 'unpaid' THEN
        RAISE EXCEPTION 'Campaigns must be submitted for review and payment';
      END IF;
    ELSE
      IF NEW.owner_id IS DISTINCT FROM OLD.owner_id
        OR NEW.budget_mwk IS DISTINCT FROM OLD.budget_mwk
        OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
        OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
        OR NEW.spent_mwk IS DISTINCT FROM OLD.spent_mwk
        OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'paused') THEN
        RAISE EXCEPTION 'Only campaign administrators can approve, charge, or change campaign budgets';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_promotion_changes_trigger ON public.promotions;
CREATE TRIGGER guard_promotion_changes_trigger
  BEFORE INSERT OR UPDATE ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION public.guard_promotion_changes();

CREATE OR REPLACE FUNCTION public.record_promotion_event(
  _promotion_id uuid,
  _event_type text,
  _event_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _campaign public.promotions%ROWTYPE;
  _cost integer := 0;
BEGIN
  IF _event_type NOT IN ('impression', 'click') THEN
    RAISE EXCEPTION 'Invalid promotion event';
  END IF;

  SELECT * INTO _campaign
  FROM public.promotions
  WHERE id = _promotion_id
    AND status = 'active'
    AND payment_status = 'paid'
    AND starts_at <= now()
    AND (ends_at IS NULL OR ends_at > now())
  FOR UPDATE;

  IF NOT FOUND THEN RETURN false; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.listings
    WHERE id = _campaign.listing_id AND status = 'published'
  ) THEN RETURN false; END IF;

  INSERT INTO public.promotion_events (id, promotion_id, event_type)
  VALUES (_event_id, _promotion_id, _event_type)
  ON CONFLICT (id) DO NOTHING;

  IF NOT FOUND THEN RETURN false; END IF;

  IF _event_type = 'impression' THEN
    UPDATE public.promotions SET impressions = impressions + 1 WHERE id = _promotion_id;
  ELSE
    _cost := _campaign.cost_per_click_mwk;
    UPDATE public.promotions
    SET clicks = clicks + 1,
        spent_mwk = LEAST(budget_mwk, spent_mwk + _cost),
        status = CASE WHEN spent_mwk + _cost >= budget_mwk THEN 'completed' ELSE status END
    WHERE id = _promotion_id;
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.record_promotion_event(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_promotion_event(uuid, text, uuid) TO anon, authenticated;

CREATE INDEX IF NOT EXISTS promotions_live_placement_idx
  ON public.promotions (kind, status, starts_at, ends_at)
  WHERE payment_status = 'paid';
