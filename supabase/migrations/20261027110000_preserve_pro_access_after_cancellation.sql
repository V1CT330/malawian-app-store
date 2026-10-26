-- Preserve paid Pro access through the already-paid period after cancellation.
-- Cancellation stops the next renewal; it must not revoke current paid access.

CREATE OR REPLACE FUNCTION public.is_pro(_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.user_id = _user
      AND (
        (s.status = 'active'
          AND (s.current_period_end IS NULL OR s.current_period_end > now()))
        OR
        (s.status = 'cancelled'
          AND s.current_period_end IS NOT NULL
          AND s.current_period_end > now())
      )
  );
$$;
