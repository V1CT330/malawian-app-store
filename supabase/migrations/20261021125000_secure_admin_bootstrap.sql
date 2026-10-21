-- Prevent arbitrary signed-in users from claiming the first admin role.
-- Admin bootstrap must be performed through a trusted service-role path or explicit operator action.
REVOKE ALL PRIVILEGES ON FUNCTION public.claim_first_admin() FROM PUBLIC;
REVOKE ALL PRIVILEGES ON FUNCTION public.claim_first_admin() FROM anon;
REVOKE ALL PRIVILEGES ON FUNCTION public.claim_first_admin() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO service_role;
