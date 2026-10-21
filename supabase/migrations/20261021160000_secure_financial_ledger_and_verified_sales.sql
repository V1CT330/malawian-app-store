-- Secure the developer wallet and marketplace ledger until a trusted sales/payout API exists.
-- Browser clients may read their own records, but must never mint balances, ledger entries,
-- paid orders, or withdrawal requests directly.
ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'pending';

REVOKE ALL ON TABLE public.wallets FROM anon, authenticated;
GRANT SELECT ON TABLE public.wallets TO authenticated;
DROP POLICY IF EXISTS wallets_own_insert ON public.wallets;
DROP POLICY IF EXISTS wallets_own_update ON public.wallets;

REVOKE ALL ON TABLE public.wallet_transactions FROM anon, authenticated;
GRANT SELECT ON TABLE public.wallet_transactions TO authenticated;
DROP POLICY IF EXISTS wtx_own_insert ON public.wallet_transactions;

REVOKE ALL ON TABLE public.orders FROM anon, authenticated;
GRANT SELECT ON TABLE public.orders TO authenticated;
DROP POLICY IF EXISTS orders_insert_buyer ON public.orders;
DROP POLICY IF EXISTS orders_update_seller ON public.orders;

-- Payout requests stay unavailable until the real withdrawal workflow and eligibility checks ship.
REVOKE ALL ON TABLE public.payout_requests FROM anon, authenticated;
GRANT SELECT ON TABLE public.payout_requests TO authenticated;
DROP POLICY IF EXISTS payouts_insert_own ON public.payout_requests;
DROP POLICY IF EXISTS payouts_update_admin ON public.payout_requests;

-- Defense in depth: even trusted server code cannot create/settle a purchase for an
-- unverified, non-developer, suspended, or unpublished seller.
CREATE OR REPLACE FUNCTION public.guard_order_seller_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _listing_developer uuid;
  _listing_status text;
  _kyc_status text;
  _is_developer boolean;
  _suspended boolean;
BEGIN
  IF TG_OP = 'INSERT'
     OR (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
         AND NEW.status IN ('paid', 'completed')) THEN
    SELECT l.developer_id, l.status, p.kyc_status::text, p.is_developer, p.suspended
      INTO _listing_developer, _listing_status, _kyc_status, _is_developer, _suspended
      FROM public.listings l
      JOIN public.profiles p ON p.id = l.developer_id
     WHERE l.id = NEW.listing_id;

    IF NOT FOUND OR _listing_developer IS DISTINCT FROM NEW.seller_id THEN
      RAISE EXCEPTION 'Order seller must own the listing';
    END IF;
    IF _listing_status <> 'published' THEN
      RAISE EXCEPTION 'Only published listings can be sold';
    END IF;
    IF COALESCE(_kyc_status, 'none') <> 'approved'
       OR COALESCE(_is_developer, false) IS NOT TRUE
       OR COALESCE(_suspended, false) THEN
      RAISE EXCEPTION 'Only verified, active developers can sell products';
    END IF;
    IF NEW.buyer_id IS NULL OR NEW.buyer_id = NEW.seller_id THEN
      RAISE EXCEPTION 'A valid buyer is required';
    END IF;
    IF NEW.amount_mwk <= 0 OR NEW.commission_mwk < 0 OR NEW.net_mwk < 0 THEN
      RAISE EXCEPTION 'Order amounts are invalid';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_order_seller_eligibility() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_order_seller_eligibility_trg ON public.orders;
CREATE TRIGGER guard_order_seller_eligibility_trg
  BEFORE INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_order_seller_eligibility();

COMMENT ON TABLE public.wallets IS
  'Client read-only. Wallet balance mutations must come from trusted server-side settlement logic.';
COMMENT ON TABLE public.wallet_transactions IS
  'Client read-only. Ledger entries must be written by trusted server-side settlement logic.';
COMMENT ON TABLE public.orders IS
  'Client read-only. Order creation and settlement must use trusted server-side payment logic.';
COMMENT ON TABLE public.payout_requests IS
  'Client read-only until a verified withdrawal workflow is implemented.';
