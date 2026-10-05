CREATE TABLE public.profile_cards (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_name text, developer_name text, avatar_url text, bio text, company_name text, location text,
  is_developer boolean NOT NULL DEFAULT false, kyc_status kyc_status NOT NULL DEFAULT 'none',
  reputation_score integer NOT NULL DEFAULT 0, follower_count integer NOT NULL DEFAULT 0,
  skills text[] NOT NULL DEFAULT '{}', website_url text, github_url text, portfolio_url text,
  facebook_url text, x_url text, linkedin_url text, instagram_url text, youtube_url text,
  suspended boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profile_cards TO anon, authenticated;
GRANT ALL ON public.profile_cards TO service_role;
ALTER TABLE public.profile_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read active profile cards" ON public.profile_cards FOR SELECT TO anon, authenticated USING (suspended = false);

CREATE OR REPLACE FUNCTION public.sync_profile_card() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profile_cards AS c (id, display_name, developer_name, avatar_url, bio, company_name, location, is_developer, kyc_status, reputation_score, follower_count, skills, website_url, github_url, portfolio_url, facebook_url, x_url, linkedin_url, instagram_url, youtube_url, suspended, created_at)
  VALUES (NEW.id, NEW.display_name, NEW.developer_name, NEW.avatar_url, NEW.bio, NEW.company_name, NEW.location, NEW.is_developer, NEW.kyc_status, NEW.reputation_score, NEW.follower_count, NEW.skills, NEW.website_url, NEW.github_url, NEW.portfolio_url, NEW.facebook_url, NEW.x_url, NEW.linkedin_url, NEW.instagram_url, NEW.youtube_url, NEW.suspended, NEW.created_at)
  ON CONFLICT (id) DO UPDATE SET display_name=EXCLUDED.display_name, developer_name=EXCLUDED.developer_name, avatar_url=EXCLUDED.avatar_url, bio=EXCLUDED.bio, company_name=EXCLUDED.company_name, location=EXCLUDED.location, is_developer=EXCLUDED.is_developer, kyc_status=EXCLUDED.kyc_status, reputation_score=EXCLUDED.reputation_score, follower_count=EXCLUDED.follower_count, skills=EXCLUDED.skills, website_url=EXCLUDED.website_url, github_url=EXCLUDED.github_url, portfolio_url=EXCLUDED.portfolio_url, facebook_url=EXCLUDED.facebook_url, x_url=EXCLUDED.x_url, linkedin_url=EXCLUDED.linkedin_url, instagram_url=EXCLUDED.instagram_url, youtube_url=EXCLUDED.youtube_url, suspended=EXCLUDED.suspended;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.sync_profile_card() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER sync_profile_card_trg AFTER INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_profile_card();

INSERT INTO public.profile_cards (id, display_name, developer_name, avatar_url, bio, company_name, location, is_developer, kyc_status, reputation_score, follower_count, skills, website_url, github_url, portfolio_url, facebook_url, x_url, linkedin_url, instagram_url, youtube_url, suspended, created_at)
SELECT id, display_name, developer_name, avatar_url, bio, company_name, location, is_developer, kyc_status, reputation_score, follower_count, skills, website_url, github_url, portfolio_url, facebook_url, x_url, linkedin_url, instagram_url, youtube_url, suspended, created_at FROM public.profiles
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE VIEW public.public_profiles WITH (security_invoker = on) AS
SELECT id, display_name, developer_name, avatar_url, bio, company_name, location, is_developer, kyc_status, reputation_score, follower_count, skills, website_url, github_url, portfolio_url, facebook_url, x_url, linkedin_url, instagram_url, youtube_url, created_at
FROM public.profile_cards WHERE suspended = false;
GRANT SELECT ON public.public_profiles TO anon, authenticated;