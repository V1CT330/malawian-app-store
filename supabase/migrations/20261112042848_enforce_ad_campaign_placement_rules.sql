ALTER TABLE public.ad_campaigns
  ADD CONSTRAINT ad_campaigns_custom_social_only_check
  CHECK (creative_type <> 'custom' OR NOT (placements @> ARRAY['store']::text[]));

ALTER TABLE public.ad_campaigns
  ADD CONSTRAINT ad_campaigns_valid_placements_check
  CHECK (
    cardinality(placements) > 0
    AND placements <@ ARRAY['store', 'social_feed']::text[]
  );
