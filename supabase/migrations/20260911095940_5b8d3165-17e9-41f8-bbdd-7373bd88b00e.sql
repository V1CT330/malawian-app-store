CREATE TABLE public.hosting_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  name text not null,
  slug text not null,
  source text not null default 'upload',
  repo_url text,
  branch text not null default 'main',
  framework text not null default 'static',
  provider text not null default 'mas',
  status text not null default 'offline',
  last_deployed_at timestamptz,
  visits integer not null default 0,
  bandwidth_mb numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hosting_projects TO authenticated;
GRANT ALL ON public.hosting_projects TO service_role;
ALTER TABLE public.hosting_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own hosting projects" ON public.hosting_projects FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER hosting_projects_updated BEFORE UPDATE ON public.hosting_projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.hosting_deployments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.hosting_projects(id) on delete cascade,
  owner_id uuid not null,
  status text not null default 'building',
  commit_message text,
  source text not null default 'upload',
  build_log text,
  duration_seconds integer,
  url text,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hosting_deployments TO authenticated;
GRANT ALL ON public.hosting_deployments TO service_role;
ALTER TABLE public.hosting_deployments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own hosting deployments" ON public.hosting_deployments FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE INDEX hosting_deployments_project_idx ON public.hosting_deployments(project_id, created_at DESC);

CREATE TABLE public.hosting_domains (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.hosting_projects(id) on delete cascade,
  owner_id uuid not null,
  domain text not null,
  is_primary boolean not null default false,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (domain)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hosting_domains TO authenticated;
GRANT ALL ON public.hosting_domains TO service_role;
ALTER TABLE public.hosting_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own hosting domains" ON public.hosting_domains FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());