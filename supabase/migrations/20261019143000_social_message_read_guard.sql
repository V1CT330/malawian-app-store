-- Do not compare client-supplied read timestamps to database time: device clocks may differ.
-- Keep immutable message fields protected while allowing recipients to mark messages read.
CREATE OR REPLACE FUNCTION public.guard_social_message_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> OLD.recipient_id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.recipient_id IS DISTINCT FROM OLD.recipient_id
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only the recipient may mark a message as read';
  END IF;
  RETURN NEW;
END;
$$;
