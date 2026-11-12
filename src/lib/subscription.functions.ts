import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Starts the one-time 90-day Developer Mode trial on first activation. */
export const startDeveloperTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("is_developer,developer_terms_accepted_at")
      .eq("id", context.userId)
      .maybeSingle();

    if (profileError || !profile?.is_developer || !profile.developer_terms_accepted_at) {
      throw new Error("Accept the Developer Mode terms before starting your trial.");
    }

    const { error: insertError } = await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: context.userId,
        plan: "pro",
        amount_mwk: 0,
        status: "trialing",
        current_period_end: new Date(Date.now() + 90 * 864e5).toISOString(),
      },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
    if (insertError) throw new Error("Could not activate your Developer Mode trial.");

    const { data: subscription, error: readError } = await supabaseAdmin
      .from("subscriptions")
      .select("plan,status,current_period_end")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (readError || !subscription) throw new Error("Could not verify your Developer Mode trial.");
    return subscription;
  });
