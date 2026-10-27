-- Record which developer agreement version was accepted so material updates
-- can trigger a fresh consent prompt.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS developer_terms_version text;
