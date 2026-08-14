-- 1. Pro helper -------------------------------------------------------------
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS payment_reference text;

CREATE OR REPLACE FUNCTION public.is_pro(_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = _user
      AND s.status = 'active'
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  );
$$;

-- 2. Subscriptions: no client writes ----------------------------------------
DROP POLICY IF EXISTS subs_own_all ON public.subscriptions;
DROP POLICY IF EXISTS subs_admin_read ON public.subscriptions;

CREATE POLICY subs_read_own ON public.subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY subs_admin_write ON public.subscriptions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.request_pro_subscription(_reference text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  IF coalesce(btrim(_reference), '') = '' THEN
    RAISE EXCEPTION 'A payment reference is required';
  END IF;

  INSERT INTO public.subscriptions (user_id, plan, amount_mwk, status, payment_reference)
  VALUES (_uid, 'developer_pro', 5000, 'pending', btrim(_reference))
  ON CONFLICT (user_id) DO UPDATE
    SET payment_reference = excluded.payment_reference,
        status = CASE WHEN public.subscriptions.status = 'active' THEN 'active' ELSE 'pending' END,
        updated_at = now();
END;
$$;

-- 3. Listings: developers cannot publish or feature themselves ---------------
CREATE OR REPLACE FUNCTION public.guard_listing_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin boolean := public.has_role(auth.uid(), 'admin');
BEGIN
  IF _admin THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'draft';
    NEW.featured := false;
    NEW.downloads := 0;
    NEW.rating_avg := 0;
    NEW.rating_count := 0;
    RETURN NEW;
  END IF;

  NEW.featured := OLD.featured;
  NEW.rejection_reason := OLD.rejection_reason;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'draft'     AND NEW.status = 'pending')  OR
      (OLD.status = 'pending'   AND NEW.status = 'draft')    OR
      (OLD.status = 'rejected'  AND NEW.status = 'draft')    OR
      (OLD.status = 'published' AND NEW.status = 'archived') OR
      (OLD.status = 'archived'  AND NEW.status = 'draft')
    ) THEN
      RAISE EXCEPTION 'Listings are made live by the store review team';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_listing_status_trg ON public.listings;
CREATE TRIGGER guard_listing_status_trg
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.guard_listing_status();

-- 4. Profiles: verification / suspension are admin only ----------------------
CREATE OR REPLACE FUNCTION public.guard_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  NEW.kyc_status := OLD.kyc_status;
  NEW.suspended := OLD.suspended;
  NEW.reputation_score := OLD.reputation_score;
  NEW.follower_count := OLD.follower_count;
  NEW.phone_verified := OLD.phone_verified;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_fields_trg ON public.profiles;
CREATE TRIGGER guard_profile_fields_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_fields();

-- KYC submission marks the profile pending through a definer function
CREATE OR REPLACE FUNCTION public.mark_kyc_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET kyc_status = 'pending' WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mark_kyc_pending_trg ON public.kyc_submissions;
CREATE TRIGGER mark_kyc_pending_trg
  AFTER INSERT ON public.kyc_submissions
  FOR EACH ROW EXECUTE FUNCTION public.mark_kyc_pending();

-- 5. Public profiles: safe columns only --------------------------------------
DROP POLICY IF EXISTS profiles_public_read ON public.profiles;

CREATE POLICY profiles_read_own ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = false) AS
  SELECT id, display_name, developer_name, avatar_url, bio, company_name, location,
         is_developer, kyc_status, reputation_score, follower_count, skills,
         website_url, github_url, portfolio_url, facebook_url, x_url, linkedin_url,
         instagram_url, youtube_url, created_at
  FROM public.profiles
  WHERE suspended = false;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 6. Lifecycle notifications --------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_listing_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('published', 'rejected') THEN
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (
      NEW.developer_id,
      CASE WHEN NEW.status = 'published' THEN NEW.name || ' is live' ELSE NEW.name || ' needs changes' END,
      CASE WHEN NEW.status = 'published'
        THEN 'Your product passed review and is now visible in the store.'
        ELSE coalesce(NEW.rejection_reason, 'Please update your listing and submit it again.') END
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_listing_status_trg ON public.listings;
CREATE TRIGGER notify_listing_status_trg
  AFTER UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.notify_listing_status();

CREATE OR REPLACE FUNCTION public.notify_new_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _dev uuid;
  _name text;
BEGIN
  SELECT developer_id, name INTO _dev, _name FROM public.listings WHERE id = NEW.listing_id;
  IF _dev IS NOT NULL AND _dev <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (_dev, 'New review on ' || _name, NEW.rating || ' star rating. ' || coalesce(NEW.body, ''));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_new_review_trg ON public.reviews;
CREATE TRIGGER notify_new_review_trg
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_review();

-- 7. Analytics aggregate ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.developer_stats(_developer uuid, _days integer)
RETURNS TABLE (
  day date,
  installs bigint,
  views bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH days AS (
    SELECT generate_series(current_date - (_days - 1), current_date, interval '1 day')::date AS day
  ),
  mine AS (
    SELECT id FROM public.listings WHERE developer_id = _developer
  )
  SELECT d.day,
    (SELECT count(*) FROM public.install_events i
      WHERE i.listing_id IN (SELECT id FROM mine) AND i.created_at::date = d.day),
    (SELECT count(*) FROM public.view_events v
      WHERE v.listing_id IN (SELECT id FROM mine) AND v.created_at::date = d.day)
  FROM days d ORDER BY d.day;
$$;