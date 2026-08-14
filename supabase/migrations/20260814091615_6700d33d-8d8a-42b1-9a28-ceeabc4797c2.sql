REVOKE EXECUTE ON FUNCTION public.is_pro(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.request_pro_subscription(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.developer_stats(uuid, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.compute_reputation(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.claim_first_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.is_pro(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_pro_subscription(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.developer_stats(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_reputation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) TO authenticated;