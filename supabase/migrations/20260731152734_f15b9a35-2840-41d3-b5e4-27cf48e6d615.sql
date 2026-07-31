
-- Listing monetization fields
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS monetization text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS price_month_mwk integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_year_mwk integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allow_donations boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS crypto_address text,
  ADD COLUMN IF NOT EXISTS sponsored boolean NOT NULL DEFAULT false;

-- Wallets
CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance_mwk numeric NOT NULL DEFAULT 0,
  pending_mwk numeric NOT NULL DEFAULT 0,
  lifetime_mwk numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY wallets_own_read ON public.wallets FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY wallets_own_insert ON public.wallets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY wallets_own_update ON public.wallets FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER wallets_updated BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Wallet ledger
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'sale',
  amount_mwk numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  method text,
  reference text,
  description text,
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY wtx_own_read ON public.wallet_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY wtx_own_insert ON public.wallet_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Orders / purchases
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  buyer_id uuid,
  seller_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'one_time',
  amount_mwk numeric NOT NULL DEFAULT 0,
  commission_mwk numeric NOT NULL DEFAULT 0,
  net_mwk numeric NOT NULL DEFAULT 0,
  method text NOT NULL DEFAULT 'airtel_money',
  provider_ref text,
  coupon_code text,
  country text,
  status text NOT NULL DEFAULT 'paid',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY orders_read ON public.orders FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY orders_insert_buyer ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY orders_update_seller ON public.orders FOR UPDATE TO authenticated
  USING (auth.uid() = seller_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = seller_id OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Payout destinations
CREATE TABLE IF NOT EXISTS public.payout_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'airtel_money',
  label text,
  destination text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payout_methods TO authenticated;
GRANT ALL ON public.payout_methods TO service_role;
ALTER TABLE public.payout_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY payout_methods_own ON public.payout_methods FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Withdrawals
CREATE TABLE IF NOT EXISTS public.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount_mwk numeric NOT NULL,
  method text NOT NULL DEFAULT 'airtel_money',
  destination text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.payout_requests TO authenticated;
GRANT UPDATE ON public.payout_requests TO authenticated;
GRANT ALL ON public.payout_requests TO service_role;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY payouts_read ON public.payout_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY payouts_insert_own ON public.payout_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY payouts_update_admin ON public.payout_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER payouts_updated BEFORE UPDATE ON public.payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Coupons
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  code text NOT NULL,
  percent_off integer NOT NULL DEFAULT 10,
  max_uses integer NOT NULL DEFAULT 100,
  uses integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT SELECT ON public.coupons TO anon;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY coupons_public_read ON public.coupons FOR SELECT USING (active = true);
CREATE POLICY coupons_owner_all ON public.coupons FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Sponsorships / campaigns
CREATE TABLE IF NOT EXISTS public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'featured',
  budget_mwk numeric NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotions TO authenticated;
GRANT SELECT ON public.promotions TO anon;
GRANT ALL ON public.promotions TO service_role;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY promotions_public_read ON public.promotions FOR SELECT USING (true);
CREATE POLICY promotions_owner_all ON public.promotions FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Commission settings
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_settings TO anon, authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY settings_public_read ON public.platform_settings FOR SELECT USING (true);
CREATE POLICY settings_admin_write ON public.platform_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.platform_settings (key, value) VALUES
  ('commission', '{"standard":15,"premium":10,"referral":5}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Demo catalogue
INSERT INTO public.listings (developer_id, slug, name, tagline, description, category, kind, website_url, price_mwk, monetization, status, downloads, rating_avg, rating_count, featured)
VALUES
 ('11111111-1111-4111-8111-111111111101','mzuni-notes','Mzuni Notes','Lecture notes & past papers','Offline-first study companion for Malawian university students with past papers, notes and revision timers.','Education','app',null,0,'free','published',18420,4.6,932,true),
 ('11111111-1111-4111-8111-111111111102','malipo-pay','Malipo Pay','Airtel Money & Mpamba in one wallet','Send, receive and reconcile mobile money across Airtel Money and TNM Mpamba with instant receipts.','Finance','app',null,2500,'paid','published',9310,4.4,511,true),
 ('11111111-1111-4111-8111-111111111103','nyasa-news','Nyasa News','Malawi headlines, live','Breaking news, sports and business from trusted Malawian newsrooms, with low-data mode.','News','app',null,0,'freemium','published',24500,4.2,1280,false),
 ('11111111-1111-4111-8111-111111111104','chigwirizano-market','Chigwirizano Market','Buy and sell locally','Community marketplace for produce, electronics and services across Lilongwe, Blantyre and Mzuzu.','Shopping','website','https://chigwirizano.mw',0,'ads','published',7600,4.1,320,false),
 ('11111111-1111-4111-8111-111111111105','moyo-health','Moyo Health','Clinic finder & reminders','Find nearby clinics, book appointments and get medication reminders in Chichewa and English.','Health','app',null,0,'donations','published',5120,4.7,214,true),
 ('11111111-1111-4111-8111-111111111106','tili-transport','Tili Transport','Minibus routes & fares','Live minibus routes, fares and stage maps for Malawi''s major cities.','Transport','app',null,1200,'paid','published',3980,4.0,167,false),
 ('11111111-1111-4111-8111-111111111107','kwacha-books','Kwacha Books','Small business accounting','Simple bookkeeping, invoices and tax summaries built for Malawian SMEs.','Business','app',null,0,'subscription','published',2870,4.5,143,false),
 ('11111111-1111-4111-8111-111111111108','warm-heart-tours','Warm Heart Tours','Travel Malawi','Discover lodges, lake trips and safaris with local guides and instant booking.','Entertainment','website','https://warmhearttours.mw',0,'affiliate','published',4400,4.3,198,false)
ON CONFLICT DO NOTHING;
