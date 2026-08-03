
-- ============ product kinds / status widened ============
DROP POLICY IF EXISTS listings_public_read ON public.listings;
DROP POLICY IF EXISTS versions_public_read ON public.listing_versions;
DROP POLICY IF EXISTS installs_insert_published ON public.install_events;
DROP POLICY IF EXISTS views_insert_published ON public.view_events;
ALTER TABLE public.listings ALTER COLUMN kind TYPE text USING kind::text;
ALTER TABLE public.listings ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE public.listings ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE public.listings ADD CONSTRAINT listings_kind_check CHECK (kind IN ('app','website','ai_agent','extension'));
ALTER TABLE public.listings ADD CONSTRAINT listings_status_check CHECK (status IN ('draft','pending','published','rejected','archived'));
CREATE POLICY listings_public_read ON public.listings FOR SELECT USING (status = 'published');
CREATE POLICY versions_public_read ON public.listing_versions FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.listings l WHERE l.id = listing_versions.listing_id AND l.status = 'published'));
CREATE POLICY installs_insert_published ON public.install_events FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.listings l WHERE l.id = install_events.listing_id AND l.status = 'published')
  AND (user_id IS NULL OR user_id = auth.uid()));
CREATE POLICY views_insert_published ON public.view_events FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.listings l WHERE l.id = view_events.listing_id AND l.status = 'published')
  AND (user_id IS NULL OR user_id = auth.uid()));

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS promo_images text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS keywords text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS seo_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quality_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- ============ versions ============
ALTER TABLE public.listing_versions
  ADD COLUMN IF NOT EXISTS release_notes text,
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'stable',
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'released';

-- ============ team members ============
CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  member_id uuid,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'viewer',
  status text NOT NULL DEFAULT 'invited',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, email)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages team" ON public.team_members FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "member reads own membership" ON public.team_members FOR SELECT TO authenticated
  USING (auth.uid() = member_id);
CREATE TRIGGER team_members_updated_at BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.is_team_member(_owner uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members
    WHERE owner_id = _owner AND member_id = _user AND status = 'active')
$$;

-- ============ activity log ============
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  action text NOT NULL,
  target text,
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner or team reads logs" ON public.activity_logs FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR public.is_team_member(owner_id, auth.uid()));
CREATE POLICY "actor writes logs" ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = actor_id);

-- ============ beta testers ============
CREATE TABLE IF NOT EXISTS public.beta_testers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  email text NOT NULL,
  user_id uuid,
  channel text NOT NULL DEFAULT 'private',
  status text NOT NULL DEFAULT 'invited',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, email)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.beta_testers TO authenticated;
GRANT ALL ON public.beta_testers TO service_role;
ALTER TABLE public.beta_testers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages testers" ON public.beta_testers FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "tester reads own invite" ON public.beta_testers FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.beta_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  user_id uuid,
  kind text NOT NULL DEFAULT 'feedback',
  severity text NOT NULL DEFAULT 'low',
  body text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.beta_feedback TO authenticated;
GRANT ALL ON public.beta_feedback TO service_role;
ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads feedback" ON public.beta_feedback FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = user_id);
CREATE POLICY "owner updates feedback" ON public.beta_feedback FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "tester writes feedback" ON public.beta_feedback FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============ review replies ============
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS developer_reply text,
  ADD COLUMN IF NOT EXISTS replied_at timestamptz;

-- ============ announcements ============
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id uuid NOT NULL,
  listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT SELECT ON public.announcements TO anon;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads published announcements" ON public.announcements FOR SELECT
  USING (published = true);
CREATE POLICY "developer manages announcements" ON public.announcements FOR ALL TO authenticated
  USING (auth.uid() = developer_id) WITH CHECK (auth.uid() = developer_id);
CREATE TRIGGER announcements_updated_at BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ security ============
CREATE TABLE IF NOT EXISTS public.security_settings (
  user_id uuid PRIMARY KEY,
  two_factor_enabled boolean NOT NULL DEFAULT false,
  two_factor_secret text,
  backup_codes text[] NOT NULL DEFAULT '{}',
  recovery_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.security_settings TO authenticated;
GRANT ALL ON public.security_settings TO service_role;
ALTER TABLE public.security_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own security settings" ON public.security_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER security_settings_updated_at BEFORE UPDATE ON public.security_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device text,
  platform text,
  country text,
  ip_hint text,
  session_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.login_events TO authenticated;
GRANT ALL ON public.login_events TO service_role;
ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own login events" ON public.login_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "insert own login events" ON public.login_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own login events" ON public.login_events FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ profile extras ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS reputation_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS follower_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL,
  developer_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, developer_id)
);
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT SELECT ON public.follows TO anon;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads follows" ON public.follows FOR SELECT USING (true);
CREATE POLICY "own follows" ON public.follows FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "remove own follows" ON public.follows FOR DELETE TO authenticated
  USING (auth.uid() = follower_id);

CREATE OR REPLACE FUNCTION public.refresh_follower_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE did uuid;
BEGIN
  did := COALESCE(NEW.developer_id, OLD.developer_id);
  UPDATE public.profiles SET follower_count =
    (SELECT COUNT(*) FROM public.follows WHERE developer_id = did) WHERE id = did;
  RETURN NULL;
END; $$;
CREATE TRIGGER follows_count_sync AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.refresh_follower_count();

-- ============ search events ============
CREATE TABLE IF NOT EXISTS public.search_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.search_events TO authenticated, anon;
GRANT SELECT ON public.search_events TO authenticated;
GRANT ALL ON public.search_events TO service_role;
ALTER TABLE public.search_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone logs searches" ON public.search_events FOR INSERT WITH CHECK (true);
CREATE POLICY "developer reads own search events" ON public.search_events FOR SELECT TO authenticated
  USING (listing_id IS NULL OR EXISTS (
    SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.developer_id = auth.uid()));

-- ============ feature requests ============
CREATE TABLE IF NOT EXISTS public.feature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  status text NOT NULL DEFAULT 'open',
  vote_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.feature_requests TO authenticated;
GRANT SELECT ON public.feature_requests TO anon;
GRANT ALL ON public.feature_requests TO service_role;
ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads requests" ON public.feature_requests FOR SELECT USING (true);
CREATE POLICY "authenticated creates requests" ON public.feature_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.feature_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.feature_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.feature_votes TO authenticated;
GRANT ALL ON public.feature_votes TO service_role;
ALTER TABLE public.feature_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own votes" ON public.feature_votes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.refresh_vote_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid uuid;
BEGIN
  rid := COALESCE(NEW.request_id, OLD.request_id);
  UPDATE public.feature_requests SET vote_count =
    (SELECT COUNT(*) FROM public.feature_votes WHERE request_id = rid) WHERE id = rid;
  RETURN NULL;
END; $$;
CREATE TRIGGER feature_votes_count AFTER INSERT OR DELETE ON public.feature_votes
  FOR EACH ROW EXECUTE FUNCTION public.refresh_vote_count();

-- ============ reputation ============
CREATE OR REPLACE FUNCTION public.compute_reputation(_developer uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT LEAST(100, GREATEST(0,
      (SELECT COALESCE(ROUND(AVG(rating_avg) * 8), 0)::int FROM public.listings
        WHERE developer_id = _developer AND status = 'published' AND rating_count > 0)
    + (SELECT LEAST(20, COUNT(*) * 4)::int FROM public.listings
        WHERE developer_id = _developer AND status = 'published')
    + (SELECT LEAST(15, COUNT(*) * 3)::int FROM public.listing_versions v
        JOIN public.listings l ON l.id = v.listing_id
        WHERE l.developer_id = _developer AND v.created_at > now() - interval '90 days')
    + (SELECT LEAST(15, COUNT(*) * 3)::int FROM public.reviews r
        JOIN public.listings l ON l.id = r.listing_id
        WHERE l.developer_id = _developer AND r.developer_reply IS NOT NULL)
    + (SELECT CASE WHEN kyc_status = 'approved' THEN 10 ELSE 0 END
       + CASE WHEN COALESCE(bio,'') <> '' THEN 5 ELSE 0 END
       + CASE WHEN COALESCE(website_url,'') <> '' THEN 5 ELSE 0 END
       FROM public.profiles WHERE id = _developer)
  ))
$$;
