-- Prevent authenticated users from probing arbitrary users' role assignments.
-- Existing RLS policies call has_role(auth.uid(), 'admin'), so self-checks
-- remain unchanged. Administrators and trusted service-role calls retain
-- legitimate cross-user role checks.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (
      auth.role() = 'service_role'
      OR _user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.user_roles caller_role
        WHERE caller_role.user_id = auth.uid()
          AND caller_role.role = 'admin'
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public.user_roles target_role
      WHERE target_role.user_id = _user_id
        AND target_role.role = _role
    );
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
