-- Preserve the caller-to-subject authorization guard in the public Pro helper.
CREATE OR REPLACE FUNCTION public.is_pro(_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() = _user AND EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = _user
      AND s.plan = 'pro'
      AND s.status IN ('active', 'cancelled', 'trialing')
      AND s.current_period_end IS NOT NULL
      AND s.current_period_end > now()
  );
$$;
