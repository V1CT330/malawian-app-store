import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Records a purchase: validates the listing price server-side, applies the
 * platform commission and credits the developer's wallet ledger.
 */
export const checkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        listingId: z.string().uuid(),
        kind: z.enum(["one_time", "subscription_month", "subscription_year", "iap", "donation"]),
        amountMwk: z.number().int().min(0).max(50_000_000),
        method: z.string().min(2).max(40),
        couponCode: z.string().max(40).optional(),
        country: z.string().max(8).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("id, developer_id, name, price_mwk, price_month_mwk, price_year_mwk, monetization, status")
      .eq("id", data.listingId)
      .maybeSingle();
    if (listingError) throw new Error(listingError.message);
    if (!listing || listing.status !== "published") throw new Error("Listing is not available.");

    // Server-side price resolution — never trust the client for non-donations.
    let amount = 0;
    if (data.kind === "one_time") amount = listing.price_mwk;
    else if (data.kind === "subscription_month") amount = listing.price_month_mwk;
    else if (data.kind === "subscription_year") amount = listing.price_year_mwk;
    else amount = data.amountMwk; // donations and in-app purchases are buyer-chosen

    let discount = 0;
    if (data.couponCode) {
      const { data: coupon } = await supabase
        .from("coupons")
        .select("id, percent_off, uses, max_uses, active, expires_at")
        .eq("listing_id", listing.id)
        .eq("code", data.couponCode.toUpperCase())
        .maybeSingle();
      const valid =
        coupon &&
        coupon.active &&
        coupon.uses < coupon.max_uses &&
        (!coupon.expires_at || new Date(coupon.expires_at) > new Date());
      if (!valid) throw new Error("That coupon code is not valid.");
      discount = Math.round((amount * coupon!.percent_off) / 100);
    }
    amount = Math.max(0, amount - discount);
    if (amount <= 0) throw new Error("Nothing to pay for this option.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: setting } = await supabaseAdmin
      .from("platform_settings")
      .select("value")
      .eq("key", "commission")
      .maybeSingle();
    const percent = Number((setting?.value as { standard?: number } | null)?.standard ?? 15);
    const commission = Math.round((amount * percent) / 100);
    const net = amount - commission;

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        listing_id: listing.id,
        buyer_id: userId,
        seller_id: listing.developer_id,
        kind: data.kind,
        amount_mwk: amount,
        commission_mwk: commission,
        net_mwk: net,
        method: data.method,
        coupon_code: data.couponCode ?? null,
        country: data.country ?? null,
        status: "paid",
        provider_ref: `MAS-${Date.now().toString(36).toUpperCase()}`,
      })
      .select("id, provider_ref, amount_mwk, net_mwk")
      .single();
    if (orderError) throw new Error(orderError.message);

    await supabaseAdmin.from("wallet_transactions").insert({
      user_id: listing.developer_id,
      kind: data.kind === "donation" ? "tip" : "sale",
      amount_mwk: net,
      status: "completed",
      method: data.method,
      reference: order.provider_ref,
      listing_id: listing.id,
      description: `${listing.name} · ${data.kind}`,
    });

    const { data: wallet } = await supabaseAdmin
      .from("wallets")
      .select("id, balance_mwk, lifetime_mwk")
      .eq("user_id", listing.developer_id)
      .maybeSingle();
    if (wallet) {
      await supabaseAdmin
        .from("wallets")
        .update({
          balance_mwk: Number(wallet.balance_mwk) + net,
          lifetime_mwk: Number(wallet.lifetime_mwk) + net,
        })
        .eq("id", wallet.id);
    } else {
      await supabaseAdmin
        .from("wallets")
        .insert({ user_id: listing.developer_id, balance_mwk: net, lifetime_mwk: net });
    }

    if (data.couponCode) {
      const { data: coupon } = await supabaseAdmin
        .from("coupons")
        .select("id, uses")
        .eq("listing_id", listing.id)
        .eq("code", data.couponCode.toUpperCase())
        .maybeSingle();
      if (coupon) await supabaseAdmin.from("coupons").update({ uses: coupon.uses + 1 }).eq("id", coupon.id);
    }

    await supabaseAdmin.from("notifications").insert({
      user_id: listing.developer_id,
      title: "New sale",
      body: `${listing.name} earned MK${net.toLocaleString("en-MW")} (after commission).`,
    });

    return { orderId: order.id, reference: order.provider_ref, amount, commission, net };
  });

/** Requests a withdrawal, holding the amount from the available balance. */
export const requestPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        amountMwk: z.number().int().min(1000).max(50_000_000),
        method: z.string().min(2).max(40),
        destination: z.string().min(4).max(200),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: wallet } = await supabaseAdmin
      .from("wallets")
      .select("id, balance_mwk, pending_mwk")
      .eq("user_id", userId)
      .maybeSingle();
    if (!wallet || Number(wallet.balance_mwk) < data.amountMwk) {
      throw new Error("Not enough available balance for that withdrawal.");
    }

    const { error } = await supabaseAdmin.from("payout_requests").insert({
      user_id: userId,
      amount_mwk: data.amountMwk,
      method: data.method,
      destination: data.destination,
      status: "pending",
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("wallets")
      .update({
        balance_mwk: Number(wallet.balance_mwk) - data.amountMwk,
        pending_mwk: Number(wallet.pending_mwk) + data.amountMwk,
      })
      .eq("id", wallet.id);

    await supabaseAdmin.from("wallet_transactions").insert({
      user_id: userId,
      kind: "withdrawal",
      amount_mwk: -data.amountMwk,
      status: "pending",
      method: data.method,
      description: `Withdrawal to ${data.destination}`,
    });

    return { ok: true };
  });
