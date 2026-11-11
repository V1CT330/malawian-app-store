-- Gate paid Developer Pro collaboration and beta-testing tools at the database boundary.
-- Testers retain access to their own invitations and feedback; owners need an active paid Pro period.

CREATE OR REPLACE FUNCTION public.current_user_has_pro()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.user_id = auth.uid()
      AND s.plan = 'pro'
      AND s.status IN ('active', 'cancelled')
      AND s.current_period_end IS NOT NULL
      AND s.current_period_end > now()
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_has_pro() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_has_pro() TO authenticated, service_role;

DROP POLICY IF EXISTS team_members_pro_owner_access ON public.team_members;
CREATE POLICY team_members_pro_owner_access
  ON public.team_members AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (
    auth.uid() = member_id
    OR public.has_role(auth.uid(), 'admin')
    OR (auth.uid() = owner_id AND public.current_user_has_pro())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (auth.uid() = owner_id AND public.current_user_has_pro())
  );

DROP POLICY IF EXISTS beta_testers_pro_owner_access ON public.beta_testers;
CREATE POLICY beta_testers_pro_owner_access
  ON public.beta_testers AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR (auth.uid() = owner_id AND public.current_user_has_pro())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (auth.uid() = owner_id AND public.current_user_has_pro())
  );

DROP POLICY IF EXISTS beta_feedback_pro_owner_access ON public.beta_feedback;
CREATE POLICY beta_feedback_pro_owner_access
  ON public.beta_feedback AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR (auth.uid() = owner_id AND public.current_user_has_pro())
  )
  WITH CHECK (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR (auth.uid() = owner_id AND public.current_user_has_pro())
  );

DROP POLICY IF EXISTS activity_logs_pro_owner_access ON public.activity_logs;
CREATE POLICY activity_logs_pro_owner_access
  ON public.activity_logs AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (auth.uid() = owner_id AND public.current_user_has_pro())
    OR (
      public.is_team_member(owner_id, auth.uid())
      AND EXISTS (
        SELECT 1
        FROM public.subscriptions s
        WHERE s.user_id = activity_logs.owner_id
          AND s.plan = 'pro'
          AND s.status IN ('active', 'cancelled')
          AND s.current_period_end IS NOT NULL
          AND s.current_period_end > now()
      )
    )
  );
