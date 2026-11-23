-- MAS publisher billing: MK1,000 per active listing per 30-day period.
-- Developer Pro remains optional at MK5,000/month and includes one published listing.
-- Existing published listings receive a 30-day transition period.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS included_listing_id uuid
  REFERENCES public.listings(id) ON DELETE SET NULL;

ALTER TABLE public.payment_sessions
  ADD COLUMN IF NOT EXISTS listing_id uuid
  REFERENCES public.listings(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.listing_publication_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL UNIQUE REFERENCES public.listings(id) ON DELETE CASCADE,
  developer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_mwk integer NOT NULL DEFAULT 1000 CHECK (amount_mwk = 1000),
  status text NOT NULL DEFAULT 'paid_pending'
    CHECK (status IN ('paid_pending', 'active', 'cancelled', 'expired')),
  current_period_end timestamptz,
  payment_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_publication_period_check
    CHECK ((status = 'paid_pending' AND current_period_end IS NULL)
      OR (status <> 'paid_pending' AND current_period_end IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS listing_publication_subscriptions_owner_idx
  ON public.listing_publication_subscriptions(developer_id, current_period_end DESC);

ALTER TABLE public.listing_publication_subscriptions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.listing_publication_subscriptions TO authenticated;
GRANT ALL ON public.listing_publication_subscriptions TO service_role;

DROP POLICY IF EXISTS listing_publication_subscriptions_read_own
  ON public.listing_publication_subscriptions;
CREATE POLICY listing_publication_subscriptions_read_own
  ON public.listing_publication_subscriptions
  FOR SELECT TO authenticated
  USING (
    developer_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

CREATE OR REPLACE FUNCTION public.has_listing_publication_access(_developer uuid, _listing uuid)
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

REVOKE ALL ON FUNCTION public.has_listing_publication_access(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_listing_publication_access(uuid, uuid)
  TO anon, authenticated, service_role;

UPDATE public.subscriptions s
SET included_listing_id = (
  SELECT l.id FROM public.listings l
  WHERE l.developer_id = s.user_id AND l.status = 'published'
    AND NOT EXISTS (SELECT 1 FROM public.listing_publication_subscriptions p WHERE p.listing_id = l.id)
  ORDER BY l.created_at, l.id LIMIT 1
)
WHERE s.plan = 'pro'
  AND s.status IN ('active', 'cancelled', 'trialing')
  AND s.current_period_end > now()
  AND s.included_listing_id IS NULL;

INSERT INTO public.listing_publication_subscriptions
  (listing_id, developer_id, amount_mwk, status, current_period_end)
SELECT l.id, l.developer_id, 1000, 'active', now() + interval '30 days'
FROM public.listings l
WHERE l.status = 'published'
  AND NOT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = l.developer_id AND s.plan = 'pro'
      AND s.status IN ('active', 'cancelled', 'trialing')
      AND s.current_period_end > now() AND s.included_listing_id = l.id
  )
ON CONFLICT (listing_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.require_listing_publication_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _publication public.listing_publication_subscriptions%ROWTYPE;
  _pro public.subscriptions%ROWTYPE;
BEGIN
  IF NEW.status <> 'published' OR OLD.status = 'published' THEN RETURN NEW; END IF;

  SELECT * INTO _publication
  FROM public.listing_publication_subscriptions
  WHERE listing_id = NEW.id AND developer_id = NEW.developer_id
  FOR UPDATE;

  IF FOUND AND _publication.status = 'paid_pending' THEN
    UPDATE public.listing_publication_subscriptions
    SET status = 'active', current_period_end = now() + interval '30 days', updated_at = now()
    WHERE id = _publication.id;
    RETURN NEW;
  END IF;

  IF FOUND AND _publication.status = 'active' AND _publication.current_period_end > now() THEN
    RETURN NEW;
  END IF;

  SELECT * INTO _pro
  FROM public.subscriptions
  WHERE user_id = NEW.developer_id AND plan = 'pro'
    AND status IN ('active', 'cancelled', 'trialing') AND current_period_end > now()
  FOR UPDATE;

  IF FOUND THEN
    IF _pro.included_listing_id IS NULL THEN
      UPDATE public.subscriptions SET included_listing_id = NEW.id, updated_at = now()
      WHERE id = _pro.id;
      RETURN NEW;
    ELSIF _pro.included_listing_id = NEW.id THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION
    'Publisher payment required: MK1,000 per published app per month, or use your available Developer Pro app slot.';
END;
$$;

REVOKE ALL ON FUNCTION public.require_listing_publication_entitlement() FROM PUBLIC;

DROP TRIGGER IF EXISTS a_require_pro_for_listing_submission ON public.listings;
DROP TRIGGER IF EXISTS require_listing_publication_entitlement ON public.listings;
CREATE TRIGGER require_listing_publication_entitlement
  BEFORE UPDATE OF status ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.require_listing_publication_entitlement();

DROP POLICY IF EXISTS listings_public_read ON public.listings;
CREATE POLICY listings_public_read ON public.listings
  FOR SELECT TO anon, authenticated
  USING (status = 'published' AND public.has_listing_publication_access(developer_id, id));

CREATE OR REPLACE FUNCTION public.settle_mas_payment_session(_tx_ref text, _provider_reference text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _session public.payment_sessions%ROWTYPE;
  _listing_owner uuid;
  _listing_status text;
  _existing_end timestamptz;
  _included_listing uuid;
  _period interval;
BEGIN
  SELECT * INTO _session FROM public.payment_sessions WHERE tx_ref = _tx_ref FOR UPDATE;
  IF NOT FOUND THEN RETURN 'unknown'; END IF;
  IF _session.status = 'paid' THEN RETURN 'already'; END IF;
  IF _session.status <> 'pending' THEN RETURN 'not_pending'; END IF;
  IF _session.currency <> 'MWK' OR _session.amount_mwk <= 0 THEN
    RAISE EXCEPTION 'Invalid payment session amount or currency';
  END IF;

  UPDATE public.payment_sessions
  SET status = 'paid', paid_at = now(), provider_reference = _provider_reference, updated_at = now()
  WHERE id = _session.id;

  IF _session.purpose = 'developer_pro' THEN
    _period := CASE WHEN _session.amount_mwk >= 12000 THEN interval '365 days' ELSE interval '30 days' END;
    SELECT current_period_end, included_listing_id INTO _existing_end, _included_listing
    FROM public.subscriptions WHERE user_id = _session.user_id FOR UPDATE;
    _existing_end := greatest(coalesce(_existing_end, now()), now());

    INSERT INTO public.subscriptions (
      user_id, plan, amount_mwk, status, payment_reference, current_period_end, included_listing_id
    ) VALUES (
      _session.user_id, 'pro', _session.amount_mwk, 'active', _tx_ref, _existing_end + _period, _included_listing
    )
    ON CONFLICT (user_id) DO UPDATE SET
      plan = 'pro', amount_mwk = EXCLUDED.amount_mwk, status = 'active',
      payment_reference = EXCLUDED.payment_reference,
      current_period_end = EXCLUDED.current_period_end, updated_at = now();

    UPDATE public.subscriptions s
    SET included_listing_id = (
      SELECT l.id FROM public.listings l
      WHERE l.developer_id = _session.user_id AND l.status = 'published'
        AND NOT EXISTS (
          SELECT 1 FROM public.listing_publication_subscriptions p
          WHERE p.listing_id = l.id AND p.status IN ('active', 'paid_pending')
        )
      ORDER BY l.created_at, l.id LIMIT 1
    )
    WHERE s.user_id = _session.user_id AND s.plan = 'pro' AND s.included_listing_id IS NULL;

  ELSIF _session.purpose = 'publisher_listing' THEN
    IF _session.listing_id IS NULL THEN RAISE EXCEPTION 'Publisher payment is missing its listing'; END IF;
    SELECT developer_id, status INTO _listing_owner, _listing_status
    FROM public.listings WHERE id = _session.listing_id FOR UPDATE;
    IF NOT FOUND OR _listing_owner <> _session.user_id THEN
      RAISE EXCEPTION 'Publisher payment listing does not belong to this developer';
    END IF;

    SELECT current_period_end INTO _existing_end
    FROM public.listing_publication_subscriptions
    WHERE listing_id = _session.listing_id FOR UPDATE;

    IF _listing_status = 'published' THEN
      _existing_end := greatest(coalesce(_existing_end, now()), now());
      INSERT INTO public.listing_publication_subscriptions (
        listing_id, developer_id, amount_mwk, status, current_period_end, payment_reference
      ) VALUES (
        _session.listing_id, _session.user_id, 1000, 'active', _existing_end + interval '30 days', _tx_ref
      )
      ON CONFLICT (listing_id) DO UPDATE SET
        developer_id = EXCLUDED.developer_id, amount_mwk = 1000, status = 'active',
        current_period_end = EXCLUDED.current_period_end, payment_reference = EXCLUDED.payment_reference,
        updated_at = now();
    ELSE
      INSERT INTO public.listing_publication_subscriptions (
        listing_id, developer_id, amount_mwk, status, current_period_end, payment_reference
      ) VALUES (_session.listing_id, _session.user_id, 1000, 'paid_pending', NULL, _tx_ref)
      ON CONFLICT (listing_id) DO UPDATE SET
        developer_id = EXCLUDED.developer_id, amount_mwk = 1000, status = 'paid_pending',
        current_period_end = NULL, payment_reference = EXCLUDED.payment_reference, updated_at = now();
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported MAS payment purpose: %', _session.purpose;
  END IF;

  RETURN 'paid';
END;
$$;

REVOKE ALL ON FUNCTION public.settle_mas_payment_session(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_mas_payment_session(text, text) TO service_role;
