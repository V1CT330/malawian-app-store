
CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
CREATE TYPE public.listing_kind AS ENUM ('app','website');
CREATE TYPE public.listing_status AS ENUM ('draft','pending','published','rejected');
CREATE TYPE public.kyc_status AS ENUM ('none','pending','approved','rejected');

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  phone TEXT,
  phone_verified BOOLEAN NOT NULL DEFAULT false,
  is_developer BOOLEAN NOT NULL DEFAULT false,
  developer_name TEXT,
  kyc_status public.kyc_status NOT NULL DEFAULT 'none',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_public_read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)), NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_read_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- listings
CREATE TABLE public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id UUID NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Other',
  kind public.listing_kind NOT NULL DEFAULT 'app',
  icon_url TEXT,
  screenshots TEXT[] NOT NULL DEFAULT '{}',
  website_url TEXT,
  price_mwk INTEGER NOT NULL DEFAULT 0,
  status public.listing_status NOT NULL DEFAULT 'published',
  downloads INTEGER NOT NULL DEFAULT 0,
  rating_avg NUMERIC(2,1) NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings TO authenticated;
GRANT ALL ON public.listings TO service_role;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "listings_public_read" ON public.listings FOR SELECT USING (status = 'published');
CREATE POLICY "listings_owner_read" ON public.listings FOR SELECT TO authenticated USING (auth.uid() = developer_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "listings_owner_insert" ON public.listings FOR INSERT TO authenticated WITH CHECK (auth.uid() = developer_id);
CREATE POLICY "listings_owner_update" ON public.listings FOR UPDATE TO authenticated USING (auth.uid() = developer_id OR public.has_role(auth.uid(),'admin')) WITH CHECK (auth.uid() = developer_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "listings_owner_delete" ON public.listings FOR DELETE TO authenticated USING (auth.uid() = developer_id);
CREATE TRIGGER listings_updated_at BEFORE UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- versions
CREATE TABLE public.listing_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  changelog TEXT,
  file_url TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.listing_versions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_versions TO authenticated;
GRANT ALL ON public.listing_versions TO service_role;
ALTER TABLE public.listing_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "versions_public_read" ON public.listing_versions FOR SELECT USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.status = 'published'));
CREATE POLICY "versions_owner_all" ON public.listing_versions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.developer_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.developer_id = auth.uid()));

-- reviews
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (listing_id, user_id)
);
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_public_read" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert_own" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews_update_own" ON public.reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews_delete_own" ON public.reviews FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER reviews_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.refresh_listing_rating() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lid UUID;
BEGIN
  lid := COALESCE(NEW.listing_id, OLD.listing_id);
  UPDATE public.listings l SET
    rating_avg = COALESCE((SELECT ROUND(AVG(r.rating)::numeric,1) FROM public.reviews r WHERE r.listing_id = lid),0),
    rating_count = (SELECT COUNT(*) FROM public.reviews r WHERE r.listing_id = lid)
  WHERE l.id = lid;
  RETURN NULL;
END; $$;
CREATE TRIGGER reviews_rating_sync AFTER INSERT OR UPDATE OR DELETE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.refresh_listing_rating();

-- kyc
CREATE TABLE public.kyc_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  id_type TEXT NOT NULL,
  id_number TEXT NOT NULL,
  document_url TEXT,
  selfie_url TEXT,
  status public.kyc_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.kyc_submissions TO authenticated;
GRANT ALL ON public.kyc_submissions TO service_role;
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kyc_read_own" ON public.kyc_submissions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "kyc_insert_own" ON public.kyc_submissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kyc_update_admin" ON public.kyc_submissions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER kyc_updated_at BEFORE UPDATE ON public.kyc_submissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- subscriptions
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'developer',
  amount_mwk INTEGER NOT NULL DEFAULT 5000,
  status TEXT NOT NULL DEFAULT 'inactive',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subs_own_all" ON public.subscriptions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER subs_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- phone verifications
CREATE TABLE public.phone_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '15 minutes',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.phone_verifications TO authenticated;
GRANT ALL ON public.phone_verifications TO service_role;
ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "phone_own_all" ON public.phone_verifications FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- install events
CREATE TABLE public.install_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.install_events TO anon, authenticated;
GRANT SELECT ON public.install_events TO authenticated;
GRANT ALL ON public.install_events TO service_role;
ALTER TABLE public.install_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "installs_insert_any" ON public.install_events FOR INSERT WITH CHECK (true);
CREATE POLICY "installs_dev_read" ON public.install_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.developer_id = auth.uid()));

CREATE INDEX idx_listings_status ON public.listings(status);
CREATE INDEX idx_listings_dev ON public.listings(developer_id);
CREATE INDEX idx_versions_listing ON public.listing_versions(listing_id);
CREATE INDEX idx_reviews_listing ON public.reviews(listing_id);
CREATE INDEX idx_installs_listing ON public.install_events(listing_id, created_at);
