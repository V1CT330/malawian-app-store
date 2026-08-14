CREATE OR REPLACE FUNCTION public.confirm_phone(_phone text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  IF coalesce(btrim(_phone), '') = '' THEN
    RAISE EXCEPTION 'Enter a phone number';
  END IF;
  UPDATE public.profiles
     SET phone = btrim(_phone), phone_verified = true, updated_at = now()
   WHERE id = _uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.confirm_phone(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.confirm_phone(text) TO authenticated;