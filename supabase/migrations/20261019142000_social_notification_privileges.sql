-- These functions are trigger-only. They must not be callable through PostgREST RPC.
REVOKE EXECUTE ON FUNCTION public.notify_social_connection() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_social_post_activity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_social_message() FROM PUBLIC, anon, authenticated;
