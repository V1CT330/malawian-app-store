-- Add developer-managed portfolio entries for projects published outside MAS.
-- MAS-published listings remain sourced from public.listings and need no duplication.

CREATE TABLE IF NOT EXISTS public.developer_portfolio_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 100),
  description text CHECK (description IS NULL OR char_length(description) <= 500),
  project_type text NOT NULL DEFAULT 'website'
    CHECK (project_type IN ('app', 'website', 'game', 'tool', 'other')),
  url text NOT NULL CHECK (url ~* '^https://'),
  image_url text CHECK (image_url IS NULL OR image_url ~* '^https://'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS developer_portfolio_projects_owner_created_idx
  ON public.developer_portfolio_projects (developer_id, created_at DESC);

ALTER TABLE public.developer_portfolio_projects ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.developer_portfolio_projects TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.developer_portfolio_projects TO authenticated;

DROP POLICY IF EXISTS developer_portfolio_projects_public_read ON public.developer_portfolio_projects;
CREATE POLICY developer_portfolio_projects_public_read
  ON public.developer_portfolio_projects
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS developer_portfolio_projects_insert_own ON public.developer_portfolio_projects;
CREATE POLICY developer_portfolio_projects_insert_own
  ON public.developer_portfolio_projects
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = developer_id);

DROP POLICY IF EXISTS developer_portfolio_projects_update_own ON public.developer_portfolio_projects;
CREATE POLICY developer_portfolio_projects_update_own
  ON public.developer_portfolio_projects
  FOR UPDATE TO authenticated
  USING (auth.uid() = developer_id)
  WITH CHECK (auth.uid() = developer_id);

DROP POLICY IF EXISTS developer_portfolio_projects_delete_own ON public.developer_portfolio_projects;
CREATE POLICY developer_portfolio_projects_delete_own
  ON public.developer_portfolio_projects
  FOR DELETE TO authenticated
  USING (auth.uid() = developer_id);
