import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PRO_MONTHLY_PRICE_MWK } from "@/lib/pro";
import { PUBLISHER_MONTHLY_PRICE_MWK } from "@/lib/monetization";
import { z } from "zod";

/** Creates a server-side PayChangu hosted checkout for Developer Pro. */
export const startProCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createPaychanguCheckout } = await import("@/lib/payments.server");
    const origin = new URL(getRequest().url).origin;
    const email = (context.claims as { email?: string }).email ?? "";
    const { data: pendingSession, error: pendingSessionError } = await admin
      .from("payment_sessions")
      .select("checkout_url")
      .eq("user_id", context.userId)
      .eq("purpose", "publisher_listing")
      .eq("listing_id", listing.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingSessionError) throw new Error("Could not check for an existing Publisher checkout.");
    if (pendingSession?.checkout_url) return { checkoutUrl: pendingSession.checkout_url };
    if (pendingSession) return { pendingCheckout: true };

    const txRef = `mas_${crypto.randomUUID().replace(/-/g, "")}`;
    const returnUrl = `${origin}/api/public/payments/return?tx_ref=${txRef}`;

    const { error: insertError } = await supabaseAdmin.from("payment_sessions").insert({
      user_id: context.userId,
      tx_ref: txRef,
      purpose: "developer_pro",
      amount_mwk: PRO_MONTHLY_PRICE_MWK,
      status: "pending",
    });
    if (insertError) throw new Error("Could not start payment.");

    try {
      const checkoutUrl = await createPaychanguCheckout({
        txRef,
        amount: PRO_MONTHLY_PRICE_MWK,
        productName: "Developer Pro",
        description: "One-month Developer Pro subscription",
        email,
        name: "Developer",
        // PayChangu redirects the customer to callback_url after success.
        // Keep the webhook endpoint for server-to-server POST notifications only.
        callbackUrl: `${origin}/api/public/payments/return`,
        returnUrl,
      });

      const { error: updateError } = await supabaseAdmin
        .from("payment_sessions")
        .update({ checkout_url: checkoutUrl })
        .eq("tx_ref", txRef);
      if (updateError) throw new Error("Could not save payment session.");

      return { checkoutUrl };
    } catch (error) {
      await supabaseAdmin
        .from("payment_sessions")
        .update({ status: "failed" })
        .eq("tx_ref", txRef)
        .eq("status", "pending");

      // Preserve the safe provider error so the real integration failure is visible.
      if (error instanceof Error) throw error;
      throw new Error("PayChangu could not start this payment. Please try again.");
    }
  });


const PublisherCheckoutInput = z.object({ listingId: z.string().uuid() });

/** Starts a verified MK1,000 / 30-day publishing payment for one owned listing. */
export const startPublisherCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => PublisherCheckoutInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createPaychanguCheckout } = await import("@/lib/payments.server");
    const admin = supabaseAdmin as any;
    const origin = new URL(getRequest().url).origin;
    const email = (context.claims as { email?: string }).email ?? "";

    const { data: listing, error: listingError } = await admin
      .from("listings")
      .select("id,name,developer_id,status")
      .eq("id", data.listingId)
      .eq("developer_id", context.userId)
      .maybeSingle();

    if (listingError || !listing) throw new Error("This listing was not found in your developer account.");
    if (!["draft", "pending", "published", "rejected"].includes(listing.status)) {
      throw new Error("Only active or reviewable listings can receive Publisher coverage.");
    }

    const { data: publication, error: publicationError } = await admin
      .from("listing_publication_subscriptions")
      .select("status,current_period_end,is_grace_period")
      .eq("listing_id", listing.id)
      .maybeSingle();
    if (publicationError) throw new Error("Could not check this listing's publishing status.");

    const publicationActive =
      publication?.status === "active" &&
      !publication.is_grace_period &&
      Date.parse(publication.current_period_end ?? "") > Date.now();
    if (publicationActive) {
      return { alreadyActive: true, currentPeriodEnd: publication.current_period_end };
    }
    if (publication?.status === "paid_pending") return { pendingPublication: true };

    const { data: subscription, error: subscriptionError } = await admin
      .from("subscriptions")
      .select("id,plan,status,current_period_end,included_listing_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (subscriptionError) throw new Error("Could not check your Developer Pro entitlement.");

    const proActive =
      subscription?.plan === "pro" &&
      ["active", "cancelled", "trialing"].includes(subscription.status) &&
      Date.parse(subscription.current_period_end ?? "") > Date.now();

    if (proActive && subscription.included_listing_id === listing.id) {
      return { included: true };
    }

    if (proActive && !subscription.included_listing_id) {
      const { data: claimed, error: claimError } = await admin
        .from("subscriptions")
        .update({ included_listing_id: listing.id })
        .eq("id", subscription.id)
        .is("included_listing_id", null)
        .select("id");
      if (claimError) throw new Error("Could not assign your included Pro publishing slot.");
      if (claimed?.length) return { included: true };

      const { data: latest } = await admin
        .from("subscriptions")
        .select("included_listing_id")
        .eq("id", subscription.id)
        .maybeSingle();
      if (latest?.included_listing_id === listing.id) return { included: true };
    }

    const txRef = `mas_${crypto.randomUUID().replace(/-/g, "")}`;
    const returnUrl = `${origin}/api/public/payments/return?tx_ref=${txRef}`;
    const { error: insertError } = await admin.from("payment_sessions").insert({
      user_id: context.userId,
      tx_ref: txRef,
      purpose: "publisher_listing",
      listing_id: listing.id,
      amount_mwk: PUBLISHER_MONTHLY_PRICE_MWK,
      currency: "MWK",
      status: "pending",
    });
    if (insertError) throw new Error("Could not start the Publisher payment.");

    try {
      const checkoutUrl = await createPaychanguCheckout({
        txRef,
        amount: PUBLISHER_MONTHLY_PRICE_MWK,
        email,
        name: "MAS Publisher",
        productName: "Publisher",
        description: `30-day publishing fee for ${listing.name}`,
        callbackUrl: `${origin}/api/public/payments/return`,
        returnUrl,
      });
      const { error: updateError } = await admin
        .from("payment_sessions")
        .update({ checkout_url: checkoutUrl })
        .eq("tx_ref", txRef);
      if (updateError) throw new Error("Could not save the Publisher checkout session.");
      return { checkoutUrl };
    } catch (error) {
      await admin.from("payment_sessions")
        .update({ status: "failed" })
        .eq("tx_ref", txRef)
        .eq("status", "pending");
      if (error instanceof Error) throw error;
      throw new Error("PayChangu could not start this Publisher payment. Please try again.");
    }
  });


/** Cancels renewal server-side; the current paid period remains available. */
export const cancelProSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: subscription, error: readError } = await supabaseAdmin
      .from("subscriptions")
      .select("id,status,current_period_end")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (readError) throw new Error("Could not read subscription status.");
    if (!subscription || subscription.status !== "active") {
      throw new Error("There is no active Developer Pro subscription to cancel.");
    }

    const { error: updateError } = await supabaseAdmin
      .from("subscriptions")
      .update({ status: "cancelled" })
      .eq("id", subscription.id)
      .eq("status", "active");

    if (updateError) throw new Error("Could not cancel the subscription.");
    return { currentPeriodEnd: subscription.current_period_end };
  });
