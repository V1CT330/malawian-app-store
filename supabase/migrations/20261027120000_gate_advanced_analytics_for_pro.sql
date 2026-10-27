-- Advanced analytics is a Developer Pro benefit. Enforce it in database access
-- as well as the UI, while keeping ordinary product listing data available.

CREATE OR REPLACE FUNCTION public.developer_stats(_developer uuid, _days integer)
RETURNS TABLE(day date, installs bigint, views bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() <> _developer AND NOT public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin') AND NOT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.user_id = auth.uid()
      AND (
        (s.status = 'active' AND (s.current_period_end IS NULL OR s.current_period_end > now()))
        OR (s.status = 'cancelled' AND s.current_period_end IS NOT NULL AND s.current_period_end > now())
      )
  ) THEN
    RAISE EXCEPTION 'Developer Pro subscription required for advanced analytics.';
  END IF;

  RETURN QUERY
  WITH days AS (
    SELECT generate_series(current_date - (LEAST(GREATEST(_days, 1), 365) - 1), current_date, interval '1 day')::date AS d
  ),
  mine AS (SELECT id FROM public.listings WHERE developer_id = _developer)
  SELECT x.d,
    (SELECT count(*) FROM public.install_events i WHERE i.listing_id IN (SELECT id FROM mine) AND i.created_at::date = x.d),
    (SELECT count(*) FROM public.view_events v WHERE v.listing_id IN (SELECT id FROM mine) AND v.created_at::date = x.d)
  FROM days x ORDER BY x.d;
END;
$$;

DROP POLICY IF EXISTS install_events_pro_analytics_select ON public.install_events;
CREATE POLICY install_events_pro_analytics_select
  ON public.install_events AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = auth.uid()
        AND (
          (s.status = 'active' AND (s.current_period_end IS NULL OR s.current_period_end > now()))
          OR (s.status = 'cancelled' AND s.current_period_end IS NOT NULL AND s.current_period_end > now())
        )
    )
  );

DROP POLICY IF EXISTS view_events_pro_analytics_select ON public.view_events;
CREATE POLICY view_events_pro_analytics_select
  ON public.view_events AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = auth.uid()
        AND (
          (s.status = 'active' AND (s.current_period_end IS NULL OR s.current_period_end > now()))
          OR (s.status = 'cancelled' AND s.current_period_end IS NOT NULL AND s.current_period_end > now())
        )
    )
  );
