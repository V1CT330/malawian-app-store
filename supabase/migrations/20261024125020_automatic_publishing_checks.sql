-- Safe automated publishing for KYC-verified developers.
-- Websites can publish automatically after deterministic listing checks pass.
-- Downloadable binaries remain in the manual-review queue until malware scanning exists.

CREATE TABLE IF NOT EXISTS public.publish_check_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  developer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  passed boolean NOT NULL DEFAULT false,
  auto_published boolean NOT NULL DEFAULT false,
  review_required boolean NOT NULL DEFAULT false,
  reasons text[] NOT NULL DEFAULT '{}',
  risk_flags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.publish_check_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.publish_check_runs FROM anon, authenticated;
GRANT SELECT ON public.publish_check_runs TO authenticated;
CREATE POLICY "developers_read_own_publish_checks" ON public.publish_check_runs FOR SELECT TO authenticated
USING (developer_id = (select auth.uid()) OR public.has_role((select auth.uid()), 'admin'));

CREATE OR REPLACE FUNCTION public.guard_listing_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  _admin boolean := public.has_role(auth.uid(), 'admin');
  _auto_publish boolean := COALESCE(current_setting('app.auto_publish', true), 'off') = 'on';
BEGIN
  IF _admin THEN RETURN NEW; END IF;
  IF _auto_publish THEN
    IF TG_OP = 'UPDATE' AND NEW.status = 'published' AND OLD.status IN ('draft', 'rejected')
      AND NEW.developer_id = auth.uid() THEN
      NEW.featured := OLD.featured;
      NEW.rejection_reason := OLD.rejection_reason;
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Automated publishing permission is valid only for an eligible listing';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'draft'; NEW.featured := false; NEW.downloads := 0;
    NEW.rating_avg := 0; NEW.rating_count := 0;
    RETURN NEW;
  END IF;
  NEW.featured := OLD.featured;
  NEW.rejection_reason := OLD.rejection_reason;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
    (OLD.status = 'draft' AND NEW.status = 'pending') OR
    (OLD.status = 'pending' AND NEW.status = 'draft') OR
    (OLD.status = 'rejected' AND NEW.status = 'draft') OR
    (OLD.status = 'published' AND NEW.status = 'archived') OR
    (OLD.status = 'archived' AND NEW.status = 'draft')
  ) THEN
    RAISE EXCEPTION 'Listings are made live by the store review team or automated publishing checks';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.attempt_auto_publish(_listing_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  _user uuid := auth.uid();
  _listing public.listings%ROWTYPE;
  _kyc text;
  _is_developer boolean;
  _suspended boolean;
  _reasons text[] := '{}';
  _risk_flags text[] := '{}';
  _file_url text;
  _review_required boolean := false;
  _auto_published boolean := false;
  _passed boolean := false;
  _new_status text;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Sign in before running publishing checks'; END IF;
  SELECT * INTO _listing FROM public.listings WHERE id = _listing_id AND developer_id = _user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found in your developer account'; END IF;
  IF _listing.status NOT IN ('draft', 'rejected') THEN RAISE EXCEPTION 'Only draft or rejected products can run publishing checks'; END IF;

  SELECT p.kyc_status::text, p.is_developer, p.suspended INTO _kyc, _is_developer, _suspended
  FROM public.profiles p WHERE p.id = _user;
  IF COALESCE(_is_developer, false) IS NOT TRUE THEN _reasons := array_append(_reasons, 'Complete developer account setup before publishing.'); END IF;
  IF COALESCE(_kyc, 'none') <> 'approved' THEN _reasons := array_append(_reasons, 'Complete identity verification (KYC) before publishing.'); END IF;
  IF COALESCE(_suspended, false) THEN _reasons := array_append(_reasons, 'Your developer account is restricted. Contact store support.'); END IF;
  IF length(btrim(COALESCE(_listing.name, ''))) < 3 THEN _reasons := array_append(_reasons, 'Product name must contain at least 3 characters.'); END IF;
  IF length(btrim(COALESCE(_listing.tagline, ''))) < 20 THEN _reasons := array_append(_reasons, 'Add a short description of at least 20 characters.'); END IF;
  IF length(btrim(COALESCE(_listing.description, ''))) < 200 THEN _reasons := array_append(_reasons, 'Add a full description of at least 200 characters.'); END IF;
  IF length(btrim(COALESCE(_listing.category, ''))) = 0 OR _listing.category = 'Other' THEN _reasons := array_append(_reasons, 'Choose a specific product category.'); END IF;
  IF COALESCE(btrim(_listing.icon_url), '') = '' THEN _reasons := array_append(_reasons, 'Upload a product icon.'); END IF;
  IF COALESCE(array_length(_listing.screenshots, 1), 0) < 2 THEN _reasons := array_append(_reasons, 'Add at least 2 product screenshots.'); END IF;

  IF _listing.kind = 'website' THEN
    IF COALESCE(_listing.website_url, '') !~* '^https://([a-z0-9-]+\.)+[a-z]{2,}(:[0-9]{1,5})?(/[^[:space:]]*)?$' THEN
      _reasons := array_append(_reasons, 'Use a valid public HTTPS website address.');
    END IF;
  ELSE
    SELECT v.file_url INTO _file_url FROM public.listing_versions v
    WHERE v.listing_id = _listing.id ORDER BY v.created_at DESC LIMIT 1;
    IF COALESCE(btrim(_file_url), '') = '' THEN
      _reasons := array_append(_reasons, 'Upload a release package before submitting.');
    ELSE
      _risk_flags := array_append(_risk_flags, 'binary_security_scan_required');
      _review_required := true;
    END IF;
  END IF;

  _passed := cardinality(_reasons) = 0;
  IF _passed AND _review_required THEN
    UPDATE public.listings SET status = 'pending' WHERE id = _listing.id;
    _new_status := 'pending';
    INSERT INTO public.notifications (user_id, title, body) VALUES (
      _user, _listing.name || ' needs a security review',
      'Your listing passed the automatic metadata and KYC checks. Downloadable packages still require a security review before they can go live.'
    );
  ELSIF _passed THEN
    PERFORM set_config('app.auto_publish', 'on', true);
    UPDATE public.listings SET status = 'published', rejection_reason = NULL WHERE id = _listing.id;
    PERFORM set_config('app.auto_publish', 'off', true);
    _auto_published := true;
    _new_status := 'published';
  ELSE
    _new_status := _listing.status;
  END IF;

  INSERT INTO public.publish_check_runs (listing_id, developer_id, passed, auto_published, review_required, reasons, risk_flags)
  VALUES (_listing.id, _user, _passed, _auto_published, _passed AND _review_required, _reasons, _risk_flags);
  RETURN jsonb_build_object(
    'ok', _passed, 'status', _new_status, 'auto_published', _auto_published,
    'review_required', _passed AND _review_required, 'reasons', to_jsonb(_reasons),
    'risk_flags', to_jsonb(_risk_flags),
    'message', CASE WHEN NOT _passed THEN 'Fix the listed issues and run the checks again.'
      WHEN _review_required THEN 'Checks passed. Your downloadable package is waiting for a security review.'
      ELSE 'All checks passed. Your website listing is now live.' END
  );
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('app.auto_publish', 'off', true);
  RAISE;
END;
$function$;
REVOKE ALL ON FUNCTION public.attempt_auto_publish(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attempt_auto_publish(uuid) TO authenticated;
