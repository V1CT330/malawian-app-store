import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PRO_PRICE_MWK } from "@/lib/pro";

/** Starts a Developer Pro mobile-money checkout and returns the hosted payment URL. */
export const startProCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { createPaychanguCheckout } = await import("./payments.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const origin = new URL(getRequest().url).origin;
    const email = (context.claims as { email?: string }).email ?? "";
    const txRef = `mas_${crypto.randomUUID().replace(/-/g, "")}`;

    const { error } = await supabaseAdmin.from("payment_sessions").insert({
      user_id: context.userId,
      tx_ref: txRef,
      amount_mwk: PRO_PRICE_MWK,
    });
    if (error) throw new Error("Could not start payment.");

    const checkoutUrl = await createPaychanguCheckout({
      txRef,
      amount: PRO_PRICE_MWK,
      email,
      name: email.split("@")[0] || "Developer",
      callbackUrl: `${origin}/api/public/payments/return?tx_ref=${txRef}`,
      returnUrl: `${origin}/console/subscription?payment=cancelled`,
    });
    await supabaseAdmin.from("payment_sessions").update({ checkout_url: checkoutUrl }).eq("tx_ref", txRef);
    return { checkoutUrl, txRef };
  });
