-- Keep the admin review path from publishing downloadable listings without a reviewed package.
CREATE OR REPLACE FUNCTION public.guard_listing_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  _admin boolean := public.has_role(auth.uid(), 'admin');
  _auto_publish boolean := COALESCE(current_setting('app.auto_publish', true), 'off') = 'on';
BEGIN
  IF _admin THEN
    IF NEW.status = 'published'
      AND NEW.kind <> 'website'
      AND NOT EXISTS (
        SELECT 1
        FROM public.listing_versions v
        WHERE v.listing_id = NEW.id
          AND COALESCE(btrim(v.file_url), '') <> ''
          AND v.status IN ('released', 'published')
      ) THEN
      RAISE EXCEPTION 'Cannot publish a downloadable listing without an approved release package';
    END IF;
    RETURN NEW;
  END IF;
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
