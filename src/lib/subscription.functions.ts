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

    // Assign Pro's single included publishing slot to one existing live listing
    // that is not already covered by a paid Publisher subscription.
    const admin = supabaseAdmin as any;
    const { data: currentSubscription, error: currentSubscriptionError } = await admin
      .from("subscriptions")
      .select("id,plan,status,current_period_end,included_listing_id")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (currentSubscriptionError) throw new Error("Could not verify your Pro publishing allowance.");
    const proActive =
      currentSubscription?.plan === "pro" &&
      ["active", "cancelled", "trialing"].includes(currentSubscription.status) &&
      Date.parse(currentSubscription.current_period_end ?? "") > Date.now();

    if (proActive && !currentSubscription.included_listing_id) {
      const { data: liveListings, error: listingsError } = await admin
        .from("listings")
        .select("id,created_at")
        .eq("developer_id", context.userId)
        .eq("status", "published")
        .order("created_at", { ascending: true });

      if (listingsError) throw new Error("Could not check your published listings.");

      const { data: publicationRows, error: publicationError } = await admin
        .from("listing_publication_subscriptions")
        .select("listing_id,status,current_period_end")
        .eq("developer_id", context.userId);

      if (publicationError) throw new Error("Could not check Publisher coverage.");

      const covered = new Set(
        (publicationRows ?? [])
          .filter((row: { status: string; current_period_end: string | null }) =>
            row.status === "paid_pending" ||
            (row.status === "active" && Date.parse(row.current_period_end ?? "") > Date.now()),
          )
          .map((row: { listing_id: string }) => row.listing_id),
      );
      const candidate = (liveListings ?? []).find((listing: { id: string }) => !covered.has(listing.id));

      if (candidate) {
        const { error: assignError } = await admin
          .from("subscriptions")
          .update({ included_listing_id: candidate.id })
          .eq("id", currentSubscription.id)
          .is("included_listing_id", null);
        if (assignError) throw new Error("Could not assign your included Pro publishing slot.");
      }
    }

    const { data: subscription, error: readError } = await supabaseAdmin
      .from("subscriptions")
      .select("plan,status,current_period_end")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (readError || !subscription) throw new Error("Could not verify your Developer Mode trial.");
    return subscription;
  });
