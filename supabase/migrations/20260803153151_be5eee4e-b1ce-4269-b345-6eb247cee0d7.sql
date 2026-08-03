ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS developer_reply text;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS replied_at timestamptz;
DROP POLICY IF EXISTS reviews_developer_reply ON public.reviews;
CREATE POLICY reviews_developer_reply ON public.reviews FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = reviews.listing_id AND l.developer_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = reviews.listing_id AND l.developer_id = auth.uid()));