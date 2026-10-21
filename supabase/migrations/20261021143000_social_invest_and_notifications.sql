-- MAS Social: separate social activity from store notifications and add Invest & Grow.
-- Additive only. Apply this migration to the Supabase project used by production MAS.
CREATE TABLE IF NOT EXISTS public.social_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_notifications_user_created_idx
  ON public.social_notifications (user_id, created_at DESC);
ALTER TABLE public.social_notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE, DELETE ON public.social_notifications TO authenticated;
DROP POLICY IF EXISTS social_notifications_read_own ON public.social_notifications;
CREATE POLICY social_notifications_read_own ON public.social_notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS social_notifications_update_own ON public.social_notifications;
CREATE POLICY social_notifications_update_own ON public.social_notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS social_notifications_delete_own ON public.social_notifications;
CREATE POLICY social_notifications_delete_own ON public.social_notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Keep social events out of public.notifications, which remains the store/account inbox.
CREATE OR REPLACE FUNCTION public.notify_social_connection()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT coalesce(developer_name, display_name, 'A MAS member') INTO _name
      FROM public.profiles WHERE id = NEW.requester_id;
    INSERT INTO public.social_notifications (user_id, title, body)
      VALUES (NEW.recipient_id, 'New friend request', _name || ' wants to connect with you.');
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'accepted' THEN
    SELECT coalesce(developer_name, display_name, 'A MAS member') INTO _name
      FROM public.profiles WHERE id = NEW.recipient_id;
    INSERT INTO public.social_notifications (user_id, title, body)
      VALUES (NEW.requester_id, 'Friend request accepted', _name || ' accepted your connection request.');
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_social_post_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid; _name text;
BEGIN
  IF TG_TABLE_NAME = 'social_post_reactions' THEN
    SELECT author_id INTO _owner FROM public.social_posts WHERE id = NEW.post_id;
    SELECT coalesce(display_name, 'A MAS member') INTO _name FROM public.profiles WHERE id = NEW.user_id;
    IF _owner IS NOT NULL AND _owner <> NEW.user_id THEN
      INSERT INTO public.social_notifications (user_id, title, body)
        VALUES (_owner, 'New reaction on your post', _name || ' liked your post.');
    END IF;
  ELSIF TG_TABLE_NAME = 'social_post_comments' THEN
    SELECT author_id INTO _owner FROM public.social_posts WHERE id = NEW.post_id;
    SELECT coalesce(display_name, 'A MAS member') INTO _name FROM public.profiles WHERE id = NEW.author_id;
    IF _owner IS NOT NULL AND _owner <> NEW.author_id THEN
      INSERT INTO public.social_notifications (user_id, title, body)
        VALUES (_owner, 'New comment on your post', _name || ' commented: ' || left(NEW.body, 180));
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_social_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text;
BEGIN
  SELECT coalesce(developer_name, display_name, 'A MAS member') INTO _name
    FROM public.profiles WHERE id = NEW.sender_id;
  INSERT INTO public.social_notifications (user_id, title, body)
    VALUES (NEW.recipient_id, 'New message from ' || _name, left(NEW.body, 180));
  RETURN NEW;
END; $$;

CREATE TABLE IF NOT EXISTS public.social_investment_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'both' CHECK (role IN ('founder', 'investor', 'both')),
  organization_name text CHECK (organization_name IS NULL OR char_length(organization_name) <= 120),
  headline text CHECK (headline IS NULL OR char_length(headline) <= 160),
  bio text CHECK (bio IS NULL OR char_length(bio) <= 1500),
  industries text[] NOT NULL DEFAULT '{}',
  location text CHECK (location IS NULL OR char_length(location) <= 120),
  investment_min numeric(14,2) CHECK (investment_min IS NULL OR investment_min >= 0),
  investment_max numeric(14,2) CHECK (investment_max IS NULL OR investment_max >= 0),
  currency text NOT NULL DEFAULT 'MWK' CHECK (currency IN ('MWK','USD','ZAR','GBP','EUR')),
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','connections')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (investment_min IS NULL OR investment_max IS NULL OR investment_max >= investment_min)
);
ALTER TABLE public.social_investment_profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_investment_profiles TO authenticated;
DROP POLICY IF EXISTS social_investment_profiles_read ON public.social_investment_profiles;
CREATE POLICY social_investment_profiles_read ON public.social_investment_profiles
  FOR SELECT TO authenticated USING (
    auth.uid() = user_id OR visibility = 'public' OR (
      visibility = 'connections' AND EXISTS (
        SELECT 1 FROM public.social_connections c
        WHERE c.status = 'accepted'
          AND ((c.requester_id = auth.uid() AND c.recipient_id = user_id)
            OR (c.recipient_id = auth.uid() AND c.requester_id = user_id))
      )
    )
  );
DROP POLICY IF EXISTS social_investment_profiles_insert_own ON public.social_investment_profiles;
CREATE POLICY social_investment_profiles_insert_own ON public.social_investment_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS social_investment_profiles_update_own ON public.social_investment_profiles;
CREATE POLICY social_investment_profiles_update_own ON public.social_investment_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS social_investment_profiles_delete_own ON public.social_investment_profiles;
CREATE POLICY social_investment_profiles_delete_own ON public.social_investment_profiles
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.social_investment_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 120),
  description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 20 AND 4000),
  industry text NOT NULL CHECK (char_length(btrim(industry)) BETWEEN 2 AND 80),
  stage text NOT NULL CHECK (stage IN ('idea','prototype','early_revenue','growth','established')),
  funding_goal numeric(14,2) CHECK (funding_goal IS NULL OR funding_goal > 0),
  currency text NOT NULL DEFAULT 'MWK' CHECK (currency IN ('MWK','USD','ZAR','GBP','EUR')),
  use_of_funds text CHECK (use_of_funds IS NULL OR char_length(use_of_funds) <= 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','paused','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_investment_opportunities_open_idx
  ON public.social_investment_opportunities (status, created_at DESC);
CREATE INDEX IF NOT EXISTS social_investment_opportunities_founder_idx
  ON public.social_investment_opportunities (founder_id, created_at DESC);
ALTER TABLE public.social_investment_opportunities ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_investment_opportunities TO authenticated;
DROP POLICY IF EXISTS social_investment_opportunities_read ON public.social_investment_opportunities;
CREATE POLICY social_investment_opportunities_read ON public.social_investment_opportunities
  FOR SELECT TO authenticated USING (status = 'open' OR auth.uid() = founder_id);
DROP POLICY IF EXISTS social_investment_opportunities_insert_own ON public.social_investment_opportunities;
CREATE POLICY social_investment_opportunities_insert_own ON public.social_investment_opportunities
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = founder_id);
DROP POLICY IF EXISTS social_investment_opportunities_update_own ON public.social_investment_opportunities;
CREATE POLICY social_investment_opportunities_update_own ON public.social_investment_opportunities
  FOR UPDATE TO authenticated USING (auth.uid() = founder_id) WITH CHECK (auth.uid() = founder_id);
DROP POLICY IF EXISTS social_investment_opportunities_delete_own ON public.social_investment_opportunities;
CREATE POLICY social_investment_opportunities_delete_own ON public.social_investment_opportunities
  FOR DELETE TO authenticated USING (auth.uid() = founder_id);

CREATE OR REPLACE FUNCTION public.set_social_investment_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS social_investment_profiles_updated_at ON public.social_investment_profiles;
CREATE TRIGGER social_investment_profiles_updated_at BEFORE UPDATE ON public.social_investment_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_social_investment_updated_at();
DROP TRIGGER IF EXISTS social_investment_opportunities_updated_at ON public.social_investment_opportunities;
CREATE TRIGGER social_investment_opportunities_updated_at BEFORE UPDATE ON public.social_investment_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.set_social_investment_updated_at();
