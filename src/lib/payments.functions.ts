import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PRO_PRICE_MWK } from "@/lib/pro";

/** Creates a server-side PayChangu hosted checkout for Developer Pro. */
export const startProCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createPaychanguCheckout } = await import("@/lib/payments.server");
    const origin = new URL(getRequest().url).origin;
    const email = (context.claims as { email?: string }).email ?? "";
    const txRef = `mas_${crypto.randomUUID().replace(/-/g, "")}`;
    const returnUrl = `${origin}/api/public/payments/return?tx_ref=${txRef}`;

    const { error: insertError } = await supabaseAdmin.from("payment_sessions").insert({
      user_id: context.userId,
      tx_ref: txRef,
      amount_mwk: PRO_PRICE_MWK,
      status: "pending",
    });
    if (insertError) throw new Error("Could not start payment.");

    try {
      const checkoutUrl = await createPaychanguCheckout({
        txRef,
        amount: PRO_PRICE_MWK,
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
