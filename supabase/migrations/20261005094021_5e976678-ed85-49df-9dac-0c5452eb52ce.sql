-- Trigger-only functions: nobody should call them directly
REVOKE EXECUTE ON FUNCTION public.guard_listing_status(), public.guard_profile_fields(), public.handle_new_user(), public.mark_kyc_pending(), public.notify_listing_status(), public.notify_new_review(), public.refresh_follower_count(), public.refresh_listing_rating(), public.refresh_vote_count() FROM PUBLIC, anon, authenticated;

-- Signed-in-only functions: no visitor access
REVOKE EXECUTE ON FUNCTION public.claim_first_admin(), public.confirm_phone(text), public.request_pro_subscription(text), public.register_install(uuid, text, text), public.compute_reputation(uuid), public.developer_stats(uuid, integer), public.has_role(uuid, app_role), public.is_pro(uuid), public.is_team_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_first_admin(), public.confirm_phone(text), public.request_pro_subscription(text), public.register_install(uuid, text, text), public.compute_reputation(uuid), public.developer_stats(uuid, integer), public.has_role(uuid, app_role), public.is_pro(uuid), public.is_team_member(uuid, uuid) TO authenticated, service_role;

-- Developer stats: only your own (or admin)
CREATE OR REPLACE FUNCTION public.developer_stats(_developer uuid, _days integer)
 RETURNS TABLE(day date, installs bigint, views bigint)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() <> _developer AND NOT public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  RETURN QUERY
  WITH days AS (
    SELECT generate_series(current_date - (LEAST(GREATEST(_days,1),365) - 1), current_date, interval '1 day')::date AS d
  ), mine AS (SELECT id FROM public.listings WHERE developer_id = _developer)
  SELECT x.d,
    (SELECT count(*) FROM public.install_events i WHERE i.listing_id IN (SELECT id FROM mine) AND i.created_at::date = x.d),
    (SELECT count(*) FROM public.view_events v WHERE v.listing_id IN (SELECT id FROM mine) AND v.created_at::date = x.d)
  FROM days x ORDER BY x.d;
END; $$;
REVOKE EXECUTE ON FUNCTION public.developer_stats(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.developer_stats(uuid, integer) TO authenticated, service_role;