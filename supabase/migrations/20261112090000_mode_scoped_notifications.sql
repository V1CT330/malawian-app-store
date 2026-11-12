-- Separate User Mode, Developer Mode and Social notifications.
-- Additive schema change; existing notifications remain User Mode by default.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'user';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notifications_scope_check'
      AND conrelid = 'public.notifications'::regclass
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_scope_check CHECK (scope IN ('user', 'developer', 'social'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS notifications_user_scope_created_idx
  ON public.notifications (user_id, scope, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_scope_unread_idx
  ON public.notifications (user_id, scope, read)
  WHERE read = false;

-- Reclassify known developer lifecycle alerts already in the shared inbox.
UPDATE public.notifications
SET scope = 'developer'
WHERE title = 'Identity verification update'
   OR title LIKE 'KYC %'
   OR title LIKE 'Release % approved'
   OR title LIKE 'Release % rejected'
   OR title LIKE '% is live'
   OR title LIKE '% needs changes'
   OR title LIKE '% was published'
   OR title LIKE '% was rejected'
   OR title LIKE '% was pending'
   OR title LIKE 'New review on %'
   OR title LIKE '% needs a security review';

-- Earlier Social releases briefly wrote these events to public.notifications.
-- Move those historical alerts to the existing Social-only table without changing IDs.
UPDATE public.notifications
SET scope = 'social'
WHERE title IN ('New friend request', 'Friend request accepted',
                'New reaction on your post')
   OR title LIKE 'New comment on your post'
   OR title LIKE 'New message from %';

-- Copy the historical Social alerts into the Social inbox, retaining the originals
-- in the shared table as scope='social' for a reversible migration.
INSERT INTO public.social_notifications (id, user_id, title, body, read, created_at)
SELECT id, user_id, title, coalesce(nullif(body, ''), 'Social activity update'), read, created_at
FROM public.notifications
WHERE scope = 'social'
ON CONFLICT (id) DO NOTHING;

-- Keep future known developer lifecycle events out of the User Mode inbox.
CREATE OR REPLACE FUNCTION public.assign_notification_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.scope = 'user' AND (
    NEW.title = 'Identity verification update'
    OR NEW.title LIKE 'KYC %'
    OR NEW.title LIKE 'Release % approved'
    OR NEW.title LIKE 'Release % rejected'
    OR NEW.title LIKE '% is live'
    OR NEW.title LIKE '% needs changes'
    OR NEW.title LIKE '% was published'
    OR NEW.title LIKE '% was rejected'
    OR NEW.title LIKE '% was pending'
    OR NEW.title LIKE 'New review on %'
    OR NEW.title LIKE '% needs a security review'
  ) THEN
    NEW.scope := 'developer';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_notification_scope_trg ON public.notifications;
CREATE TRIGGER assign_notification_scope_trg
  BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.assign_notification_scope();
