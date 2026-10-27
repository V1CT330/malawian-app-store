import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useIsAdmin } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/promotions")({
  head: () => ({ meta: [{ title: "Ad Campaign Review · Malawian App Store" }] }),
  component: AdminPromotionsPage,
});

function AdminPromotionsPage() {
  const isAdmin = useIsAdmin();
  const queryClient = useQueryClient();

  const campaigns = useQuery({
    queryKey: ["admin-promotions"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("promotions").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      if (!rows.length) return [];
      const { data: listings, error: listingError } = await supabase
        .from("listings")
        .select("id,name,slug,developer_id")
        .in("id", rows.map((row) => row.listing_id));
      if (listingError) throw listingError;
      const byId = new Map((listings ?? []).map((listing) => [listing.id, listing]));
      return rows.map((row) => ({ ...row, listing: byId.get(row.listing_id) ?? null }));
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.from("promotions").update({ status }).eq("id", id).eq("status", "pending");
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      toast.success(vars.status === "approved" ? "Campaign approved. The developer can now pay." : "Campaign rejected.");
      void queryClient.invalidateQueries({ queryKey: ["admin-promotions"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!isAdmin) {
    return <AppShell><section className="surface-card p-6"><h1 className="font-display text-xl font-bold">Administrator access required</h1><p className="mt-2 text-sm text-muted-foreground">Only MAS administrators can review advertising campaigns.</p><Link to="/admin" className="mt-4 inline-block text-sm underline">Back to admin panel</Link></section></AppShell>;
  }

  const rows = campaigns.data ?? [];
  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Advertising campaigns</h1>
          <p className="text-sm text-muted-foreground">Review campaign content before payment and publication.</p>
        </div>
        <Link to="/admin" className="text-sm underline">Back to admin panel</Link>
      </div>
      {campaigns.isLoading ? (
        <div className="surface-card p-6 text-sm text-muted-foreground">Loading campaigns…</div>
      ) : campaigns.isError ? (
        <div role="alert" className="surface-card p-6 text-sm">Could not load campaigns. Refresh and try again.</div>
      ) : rows.length === 0 ? (
        <div className="surface-card p-6 text-center text-sm text-muted-foreground">No campaigns have been submitted.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((campaign) => (
            <article key={campaign.id} className="surface-card space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold">{campaign.name || "Promotion campaign"}</h2>
                  {campaign.listing ? (
                    <Link to="/apps/$slug" params={{ slug: campaign.listing.slug }} className="text-sm underline">{campaign.listing.name}</Link>
                  ) : <p className="text-sm text-muted-foreground">Listing unavailable</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {campaign.kind} · {campaign.target_location || "All Malawi"} · {campaign.duration_days} days · budget MK{Number(campaign.budget_mwk).toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Billing: MK{campaign.cost_per_click_mwk} per click, impressions free.</p>
                </div>
                <Badge variant="secondary">{campaign.status}{campaign.payment_status === "paid" ? " · paid" : ""}</Badge>
              </div>
              {campaign.status === "pending" && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={decide.isPending || !campaign.listing} onClick={() => decide.mutate({ id: campaign.id, status: "approved" })}>Approve campaign</Button>
                  <Button size="sm" variant="destructive" disabled={decide.isPending} onClick={() => decide.mutate({ id: campaign.id, status: "rejected" })}>Reject</Button>
                </div>
              )}
              {campaign.status === "approved" && campaign.payment_status === "unpaid" && (
                <p className="text-sm text-muted-foreground">Approved; waiting for the developer to pay the prepaid budget.</p>
              )}
              {campaign.status === "active" && (
                <p className="text-sm text-muted-foreground">Live · {campaign.impressions} impressions · {campaign.clicks} clicks · MK{Number(campaign.spent_mwk).toLocaleString()} spent.</p>
              )}
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}
