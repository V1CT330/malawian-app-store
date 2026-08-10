CREATE TABLE IF NOT EXISTS public.spotlight_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id uuid NOT NULL,
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  opportunity text NOT NULL,
  pitch text,
  status text NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.spotlight_applications TO authenticated;
GRANT ALL ON public.spotlight_applications TO service_role;

ALTER TABLE public.spotlight_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers manage their own spotlight applications"
  ON public.spotlight_applications FOR SELECT TO authenticated
  USING (developer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Developers submit spotlight applications"
  ON public.spotlight_applications FOR INSERT TO authenticated
  WITH CHECK (developer_id = auth.uid());

CREATE POLICY "Admins update spotlight applications"
  ON public.spotlight_applications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER spotlight_applications_updated_at
  BEFORE UPDATE ON public.spotlight_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();