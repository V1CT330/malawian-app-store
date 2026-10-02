CREATE TABLE public.identity_verification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  webhook_type text NOT NULL,
  session_id text,
  status text,
  user_id uuid,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.identity_verification_events TO service_role;
ALTER TABLE public.identity_verification_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY ive_admin_read ON public.identity_verification_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.identity_verification_events TO authenticated;
CREATE INDEX ive_user_idx ON public.identity_verification_events(user_id, created_at DESC);