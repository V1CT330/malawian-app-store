ALTER TABLE public.ad_campaigns
  ADD COLUMN IF NOT EXISTS creative_type text NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS listing_name text,
  ADD COLUMN IF NOT EXISTS listing_slug text,
  ADD COLUMN IF NOT EXISTS listing_icon_url text,
  ADD COLUMN IF NOT EXISTS listing_banner_url text,
  ADD COLUMN IF NOT EXISTS listing_website_url text,
  ADD COLUMN IF NOT EXISTS listing_kind text,
  ADD COLUMN IF NOT EXISTS listing_status text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ad_campaigns_creative_type_check' AND conrelid = 'public.ad_campaigns'::regclass) THEN
    ALTER TABLE public.ad_campaigns ADD CONSTRAINT ad_campaigns_creative_type_check CHECK (creative_type IN ('app_listing', 'website_banner', 'custom'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ad_campaigns_listing_type_check' AND conrelid = 'public.ad_campaigns'::regclass) THEN
    ALTER TABLE public.ad_campaigns ADD CONSTRAINT ad_campaigns_listing_type_check CHECK (
      (creative_type = 'custom' AND listing_id IS NULL)
      OR (creative_type = 'app_listing' AND listing_id IS NOT NULL AND listing_kind = 'app')
      OR (creative_type = 'website_banner' AND (listing_id IS NULL OR listing_kind = 'website'))
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_ad_campaign_listing_snapshot()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE selected_listing public.listings%ROWTYPE;
BEGIN
  IF NEW.listing_id IS NULL THEN
    IF NEW.creative_type = 'app_listing' THEN RAISE EXCEPTION 'Choose an app listing for this campaign.'; END IF;
    NEW.listing_name := NULL; NEW.listing_slug := NULL; NEW.listing_icon_url := NULL;
    NEW.listing_banner_url := NULL; NEW.listing_website_url := NULL; NEW.listing_kind := NULL; NEW.listing_status := NULL;
    RETURN NEW;
  END IF;
  IF NEW.creative_type = 'custom' THEN RAISE EXCEPTION 'Custom adverts cannot be linked to a store listing.'; END IF;
  SELECT * INTO selected_listing FROM public.listings WHERE id = NEW.listing_id AND developer_id = NEW.advertiser_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'The selected listing does not belong to this advertiser.'; END IF;
  IF NEW.creative_type = 'app_listing' AND selected_listing.kind <> 'app' THEN RAISE EXCEPTION 'Choose an app listing for an app promotion.'; END IF;
  IF NEW.creative_type = 'website_banner' AND selected_listing.kind <> 'website' THEN RAISE EXCEPTION 'Choose a website listing for a website banner.'; END IF;
  NEW.listing_name := selected_listing.name; NEW.listing_slug := selected_listing.slug;
  NEW.listing_icon_url := selected_listing.icon_url; NEW.listing_banner_url := selected_listing.banner_url;
  NEW.listing_website_url := selected_listing.website_url; NEW.listing_kind := selected_listing.kind;
  NEW.listing_status := selected_listing.status;
  IF NEW.creative_type = 'website_banner' THEN
    NEW.destination_url := coalesce(nullif(selected_listing.website_url, ''), NEW.destination_url);
    NEW.headline := coalesce(nullif(NEW.headline, ''), selected_listing.name);
    NEW.body := coalesce(nullif(NEW.body, ''), selected_listing.tagline);
    NEW.image_url := coalesce(nullif(NEW.image_url, ''), selected_listing.banner_url, selected_listing.icon_url);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS set_ad_campaign_listing_snapshot_trg ON public.ad_campaigns;
CREATE TRIGGER set_ad_campaign_listing_snapshot_trg
BEFORE INSERT OR UPDATE OF listing_id, creative_type, advertiser_id ON public.ad_campaigns
FOR EACH ROW EXECUTE FUNCTION public.set_ad_campaign_listing_snapshot();

CREATE OR REPLACE FUNCTION public.sync_ad_campaign_listing_snapshot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.ad_campaigns
  SET listing_name = NEW.name, listing_slug = NEW.slug, listing_icon_url = NEW.icon_url,
      listing_banner_url = NEW.banner_url, listing_website_url = NEW.website_url,
      listing_kind = NEW.kind, listing_status = NEW.status
  WHERE listing_id = NEW.id;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.sync_ad_campaign_listing_snapshot() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_ad_campaign_listing_snapshot_trg ON public.listings;
CREATE TRIGGER sync_ad_campaign_listing_snapshot_trg
AFTER UPDATE OF name, slug, icon_url, banner_url, website_url, kind, status ON public.listings
FOR EACH ROW WHEN (
  OLD.name IS DISTINCT FROM NEW.name OR OLD.slug IS DISTINCT FROM NEW.slug OR
  OLD.icon_url IS DISTINCT FROM NEW.icon_url OR OLD.banner_url IS DISTINCT FROM NEW.banner_url OR
  OLD.website_url IS DISTINCT FROM NEW.website_url OR OLD.kind IS DISTINCT FROM NEW.kind OR
  OLD.status IS DISTINCT FROM NEW.status
) EXECUTE FUNCTION public.sync_ad_campaign_listing_snapshot();

CREATE OR REPLACE VIEW public.active_ad_creatives WITH (security_invoker = true) AS
SELECT id, headline, body, image_url, destination_url, placements, creative_type, listing_id,
       listing_name, listing_slug, listing_icon_url, listing_banner_url, listing_website_url,
       listing_kind, listing_status
FROM public.ad_campaigns
WHERE status = 'approved'
  AND (starts_at IS NULL OR starts_at <= now())
  AND (ends_at IS NULL OR ends_at > now())
  AND (listing_id IS NULL OR listing_status IN ('draft', 'pending', 'published'));
