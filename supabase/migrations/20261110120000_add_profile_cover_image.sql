ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cover_image_url text;

ALTER TABLE public.profile_cards
  ADD COLUMN IF NOT EXISTS cover_image_url text;

UPDATE public.profile_cards AS cards
SET cover_image_url = profiles.cover_image_url
FROM public.profiles
WHERE cards.id = profiles.id
  AND cards.cover_image_url IS DISTINCT FROM profiles.cover_image_url;

CREATE OR REPLACE FUNCTION public.sync_profile_cover_image()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profile_cards
  SET cover_image_url = NEW.cover_image_url
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_profile_cover_image() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_profile_cover_image_trg ON public.profiles;
CREATE TRIGGER sync_profile_cover_image_trg
AFTER INSERT OR UPDATE OF cover_image_url ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_cover_image();

CREATE OR REPLACE VIEW public.public_profiles WITH (security_invoker = on) AS
SELECT
  id, display_name, developer_name, avatar_url, bio, company_name, location,
  is_developer, kyc_status, reputation_score, follower_count, skills,
  website_url, github_url, portfolio_url, facebook_url, x_url, linkedin_url,
  instagram_url, youtube_url, created_at, cover_image_url
FROM public.profile_cards
WHERE suspended = false;

GRANT SELECT ON public.public_profiles TO anon, authenticated;
