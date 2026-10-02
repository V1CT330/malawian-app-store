CREATE TABLE public.payment_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tx_ref text NOT NULL UNIQUE,
  provider text NOT NULL DEFAULT 'paychangu',
  purpose text NOT NULL DEFAULT 'developer_pro',
  amount_mwk integer NOT NULL,
  currency text NOT NULL DEFAULT 'MWK',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','cancelled')),
  checkout_url text,
  provider_reference text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_sessions TO authenticated;
GRANT ALL ON public.payment_sessions TO service_role;
ALTER TABLE public.payment_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_sessions_read_own ON public.payment_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY payment_sessions_admin_read ON public.payment_sessions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX payment_sessions_user_idx ON public.payment_sessions(user_id, created_at DESC);
CREATE TRIGGER payment_sessions_updated_at BEFORE UPDATE ON public.payment_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();