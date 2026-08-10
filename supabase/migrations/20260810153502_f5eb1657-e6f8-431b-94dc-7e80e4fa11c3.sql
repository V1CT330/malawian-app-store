ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS skills text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS github_url text,
  ADD COLUMN IF NOT EXISTS portfolio_url text;

ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS target_location text,
  ADD COLUMN IF NOT EXISTS impressions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicks integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spent_mwk numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.profile_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id uuid NOT NULL,
  viewer_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.profile_views TO authenticated;
GRANT INSERT ON public.profile_views TO anon;
GRANT ALL ON public.profile_views TO service_role;

ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record a profile view"
  ON public.profile_views FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Developers read their own profile views"
  ON public.profile_views FOR SELECT TO authenticated USING (developer_id = auth.uid());

CREATE INDEX IF NOT EXISTS profile_views_developer_idx ON public.profile_views (developer_id, created_at DESC);

INSERT INTO public.platform_settings (key, value)
VALUES ('founding_program', '{"enabled": true, "promo_credit_mwk": 20000, "note": "Founding Developer promotional credits"}'::jsonb)
ON CONFLICT (key) DO NOTHING;