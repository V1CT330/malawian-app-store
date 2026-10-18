-- Atomically record Didit webhook events and update KYC state.
-- Invoker security: only service_role can execute this function.
CREATE OR REPLACE FUNCTION public.process_didit_webhook(
  _event_key text,
  _webhook_type text,
  _session_id text,
  _status text,
  _user_id uuid,
  _is_business_session boolean,
  _payload jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _inserted_count integer;
  _mapped_status public.kyc_status;
  _updated_user uuid;
BEGIN
  INSERT INTO public.identity_verification_events (
    event_key, webhook_type, session_id, status, user_id, payload
  ) VALUES (_event_key, _webhook_type, _session_id, _status, _user_id, _payload)
  ON CONFLICT (event_key) DO NOTHING;

  GET DIAGNOSTICS _inserted_count = ROW_COUNT;
  IF _inserted_count = 0 THEN
    RETURN false;
  END IF;

  -- Entity, KYB and transaction events are recorded but never treated as personal KYC.
  IF _webhook_type = 'status.updated'
     AND NOT COALESCE(_is_business_session, false)
     AND _user_id IS NOT NULL AND _status IS NOT NULL
  THEN
    _mapped_status := CASE _status
      WHEN 'Approved' THEN 'approved'::public.kyc_status
      WHEN 'Declined' THEN 'rejected'::public.kyc_status
      WHEN 'In Review' THEN 'pending'::public.kyc_status
      WHEN 'In Progress' THEN 'pending'::public.kyc_status
      WHEN 'Resubmitted' THEN 'pending'::public.kyc_status
      WHEN 'Expired' THEN 'none'::public.kyc_status
      WHEN 'KYC Expired' THEN 'none'::public.kyc_status
      WHEN 'Kyc Expired' THEN 'none'::public.kyc_status
      ELSE NULL
    END;

    IF _mapped_status IS NOT NULL THEN
      UPDATE public.profiles
         SET kyc_status = _mapped_status
       WHERE id = _user_id AND kyc_status IS DISTINCT FROM _mapped_status
      RETURNING id INTO _updated_user;

      IF _updated_user IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, body)
        VALUES (
          _updated_user,
          'Identity verification update',
          'Your identity verification status is now: ' || _status || '.'
        );
      END IF;
    END IF;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.process_didit_webhook(text, text, text, text, uuid, boolean, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_didit_webhook(text, text, text, text, uuid, boolean, jsonb) TO service_role;
