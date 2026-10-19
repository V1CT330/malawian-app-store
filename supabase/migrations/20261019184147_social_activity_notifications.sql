-- Notify participants of social activity using the existing private notifications table.
-- Trigger functions run with owner privileges; clients still cannot insert notifications directly.

CREATE OR REPLACE FUNCTION public.notify_social_connection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT coalesce(developer_name, display_name, 'A MAS member')
      INTO _name FROM public.profiles WHERE id = NEW.requester_id;
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (NEW.recipient_id, 'New friend request', _name || ' wants to connect with you.');
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'accepted' THEN
    SELECT coalesce(developer_name, display_name, 'A MAS member')
      INTO _name FROM public.profiles WHERE id = NEW.recipient_id;
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (NEW.requester_id, 'Friend request accepted', _name || ' accepted your connection request.');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS social_connection_notification_trg ON public.social_connections;
CREATE TRIGGER social_connection_notification_trg
  AFTER INSERT OR UPDATE OF status ON public.social_connections
  FOR EACH ROW EXECUTE FUNCTION public.notify_social_connection();

CREATE OR REPLACE FUNCTION public.notify_social_post_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _name text;
BEGIN
  IF TG_TABLE_NAME = 'social_post_reactions' THEN
    SELECT author_id INTO _owner FROM public.social_posts WHERE id = NEW.post_id;
    SELECT coalesce(display_name, 'A MAS member') INTO _name FROM public.profiles WHERE id = NEW.user_id;
    IF _owner IS NOT NULL AND _owner <> NEW.user_id THEN
      INSERT INTO public.notifications (user_id, title, body)
      VALUES (_owner, 'New reaction on your post', _name || ' liked your post.');
    END IF;
  ELSIF TG_TABLE_NAME = 'social_post_comments' THEN
    SELECT author_id INTO _owner FROM public.social_posts WHERE id = NEW.post_id;
    SELECT coalesce(display_name, 'A MAS member') INTO _name FROM public.profiles WHERE id = NEW.author_id;
    IF _owner IS NOT NULL AND _owner <> NEW.author_id THEN
      INSERT INTO public.notifications (user_id, title, body)
      VALUES (_owner, 'New comment on your post', _name || ' commented: ' || left(NEW.body, 180));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS social_reaction_notification_trg ON public.social_post_reactions;
CREATE TRIGGER social_reaction_notification_trg AFTER INSERT ON public.social_post_reactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_social_post_activity();
DROP TRIGGER IF EXISTS social_comment_notification_trg ON public.social_post_comments;
CREATE TRIGGER social_comment_notification_trg AFTER INSERT ON public.social_post_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_social_post_activity();

CREATE OR REPLACE FUNCTION public.notify_social_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _name text;
BEGIN
  SELECT coalesce(developer_name, display_name, 'A MAS member')
    INTO _name FROM public.profiles WHERE id = NEW.sender_id;
  INSERT INTO public.notifications (user_id, title, body)
  VALUES (NEW.recipient_id, 'New message from ' || _name, left(NEW.body, 180));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS social_message_notification_trg ON public.social_messages;
CREATE TRIGGER social_message_notification_trg AFTER INSERT ON public.social_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_social_message();
