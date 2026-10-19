-- Social foundation for authenticated MAS members.
-- This migration is intentionally additive: it does not alter existing payments,
-- identity verification, profiles, or app-store tables.

CREATE TABLE IF NOT EXISTS public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_posts_created_idx ON public.social_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS social_posts_author_idx ON public.social_posts (author_id, created_at DESC);
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_posts TO authenticated;
DROP POLICY IF EXISTS social_posts_read_authenticated ON public.social_posts;
CREATE POLICY social_posts_read_authenticated ON public.social_posts
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS social_posts_insert_own ON public.social_posts;
CREATE POLICY social_posts_insert_own ON public.social_posts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS social_posts_update_own ON public.social_posts;
CREATE POLICY social_posts_update_own ON public.social_posts
  FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS social_posts_delete_own ON public.social_posts;
CREATE POLICY social_posts_delete_own ON public.social_posts
  FOR DELETE TO authenticated USING (auth.uid() = author_id);

CREATE TABLE IF NOT EXISTS public.social_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_comments_post_idx ON public.social_post_comments (post_id, created_at);
ALTER TABLE public.social_post_comments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_post_comments TO authenticated;
DROP POLICY IF EXISTS social_comments_read_authenticated ON public.social_post_comments;
CREATE POLICY social_comments_read_authenticated ON public.social_post_comments
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS social_comments_insert_own ON public.social_post_comments;
CREATE POLICY social_comments_insert_own ON public.social_post_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS social_comments_update_own ON public.social_post_comments;
CREATE POLICY social_comments_update_own ON public.social_post_comments
  FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS social_comments_delete_own ON public.social_post_comments;
CREATE POLICY social_comments_delete_own ON public.social_post_comments
  FOR DELETE TO authenticated USING (auth.uid() = author_id);

CREATE TABLE IF NOT EXISTS public.social_post_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS social_reactions_post_idx ON public.social_post_reactions (post_id);
ALTER TABLE public.social_post_reactions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.social_post_reactions TO authenticated;
DROP POLICY IF EXISTS social_reactions_read_authenticated ON public.social_post_reactions;
CREATE POLICY social_reactions_read_authenticated ON public.social_post_reactions
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS social_reactions_insert_own ON public.social_post_reactions;
CREATE POLICY social_reactions_insert_own ON public.social_post_reactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS social_reactions_delete_own ON public.social_post_reactions;
CREATE POLICY social_reactions_delete_own ON public.social_post_reactions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.social_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requester_id <> recipient_id),
  UNIQUE (requester_id, recipient_id)
);
CREATE INDEX IF NOT EXISTS social_connections_recipient_idx ON public.social_connections (recipient_id, status);
CREATE INDEX IF NOT EXISTS social_connections_requester_idx ON public.social_connections (requester_id, status);
ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_connections TO authenticated;
DROP POLICY IF EXISTS social_connections_participant_read ON public.social_connections;
CREATE POLICY social_connections_participant_read ON public.social_connections
  FOR SELECT TO authenticated USING (auth.uid() IN (requester_id, recipient_id));
DROP POLICY IF EXISTS social_connections_request_own ON public.social_connections;
CREATE POLICY social_connections_request_own ON public.social_connections
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id AND status = 'pending');
DROP POLICY IF EXISTS social_connections_recipient_update ON public.social_connections;
CREATE POLICY social_connections_recipient_update ON public.social_connections
  FOR UPDATE TO authenticated USING (auth.uid() = recipient_id AND status = 'pending')
  WITH CHECK (auth.uid() = recipient_id AND status IN ('accepted', 'declined'));
DROP POLICY IF EXISTS social_connections_requester_cancel ON public.social_connections;
CREATE POLICY social_connections_requester_cancel ON public.social_connections
  FOR DELETE TO authenticated USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

CREATE TABLE IF NOT EXISTS public.social_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  CHECK (sender_id <> recipient_id)
);
CREATE INDEX IF NOT EXISTS social_messages_thread_idx ON public.social_messages (sender_id, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS social_messages_inbox_idx ON public.social_messages (recipient_id, created_at DESC);
ALTER TABLE public.social_messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.social_messages TO authenticated;
DROP POLICY IF EXISTS social_messages_participant_read ON public.social_messages;
CREATE POLICY social_messages_participant_read ON public.social_messages
  FOR SELECT TO authenticated USING (auth.uid() IN (sender_id, recipient_id));
DROP POLICY IF EXISTS social_messages_sender_insert ON public.social_messages;
CREATE POLICY social_messages_sender_insert ON public.social_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
DROP POLICY IF EXISTS social_messages_recipient_read_update ON public.social_messages;
CREATE POLICY social_messages_recipient_read_update ON public.social_messages
  FOR UPDATE TO authenticated USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- Prevent participants from changing message identity/content when marking it read.
CREATE OR REPLACE FUNCTION public.guard_social_message_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> OLD.recipient_id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.recipient_id IS DISTINCT FROM OLD.recipient_id
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR (NEW.read_at IS NOT NULL AND NEW.read_at > now()) THEN
    RAISE EXCEPTION 'Only the recipient may mark a message as read';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_social_message_update_trg ON public.social_messages;
CREATE TRIGGER guard_social_message_update_trg BEFORE UPDATE ON public.social_messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_social_message_update();
