CREATE TABLE public.installed_apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  installed_version_id uuid REFERENCES public.listing_versions(id) ON DELETE SET NULL,
  installed_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, listing_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.installed_apps TO authenticated;
GRANT ALL ON public.installed_apps TO service_role;

ALTER TABLE public.installed_apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "installed_apps_read_own"
ON public.installed_apps FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "installed_apps_add_own"
ON public.installed_apps FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.listings
    WHERE listings.id = installed_apps.listing_id
      AND listings.status = 'published'
      AND listings.kind = 'app'
  )
);

CREATE POLICY "installed_apps_update_own"
ON public.installed_apps FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.listings
    WHERE listings.id = installed_apps.listing_id
      AND listings.status = 'published'
      AND listings.kind = 'app'
  )
);

CREATE POLICY "installed_apps_remove_own"
ON public.installed_apps FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX installed_apps_user_updated_idx
ON public.installed_apps (user_id, updated_at DESC);

CREATE INDEX installed_apps_listing_idx
ON public.installed_apps (listing_id);

CREATE TRIGGER set_installed_apps_updated_at
BEFORE UPDATE ON public.installed_apps
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();