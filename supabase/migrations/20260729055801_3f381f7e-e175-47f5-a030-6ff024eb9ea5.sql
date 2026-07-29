
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refresh_listing_rating() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

DROP POLICY "installs_insert_any" ON public.install_events;
CREATE POLICY "installs_insert_published" ON public.install_events FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.status = 'published')
    AND (user_id IS NULL OR user_id = auth.uid())
  );
