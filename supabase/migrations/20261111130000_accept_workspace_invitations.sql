-- Accept pending workspace invitations only for the authenticated, verified email address.
CREATE OR REPLACE FUNCTION public.accept_team_invitation()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  v_accepted integer := 0;
BEGIN
  IF v_user_id IS NULL OR v_email = '' THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = v_user_id
      AND u.email_confirmed_at IS NOT NULL
      AND lower(u.email) = v_email
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.team_members
  SET member_id = v_user_id,
      status = 'active',
      updated_at = now()
  WHERE lower(btrim(email)) = v_email
    AND status = 'invited'
    AND member_id IS NULL;

  GET DIAGNOSTICS v_accepted = ROW_COUNT;
  RETURN v_accepted > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_team_invitation() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_team_invitation() TO authenticated;
