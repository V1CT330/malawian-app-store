ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS developer_terms_accepted_at timestamptz;

CREATE OR REPLACE FUNCTION public.register_install(_listing_id uuid, _device text DEFAULT NULL, _country text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.listings WHERE id = _listing_id AND status = 'published') THEN
    RAISE EXCEPTION 'Listing is not available';
  END IF;
  INSERT INTO public.install_events (listing_id, user_id, device, country)
  VALUES (_listing_id, auth.uid(), _device, _country);
  UPDATE public.listings SET downloads = downloads + 1 WHERE id = _listing_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.register_install(uuid, text, text) TO anon, authenticated;