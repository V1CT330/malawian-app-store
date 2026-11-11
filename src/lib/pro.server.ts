import { hasProAccess } from "@/lib/pro-access";

/** Server-side entitlement check. Never trust a client-supplied Pro flag. */
export async function assertProSubscription(userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("plan,status,current_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[Pro] Subscription verification failed", { code: error.code });
    throw new Error("Could not verify your Developer Pro subscription. Please try again.");
  }

  if (!hasProAccess(data)) {
    throw new Error("Developer Pro is required to use this feature. Upgrade your plan to continue.");
  }
}
