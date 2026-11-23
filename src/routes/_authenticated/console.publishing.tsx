import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Rocket } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import { AppIcon } from "@/components/ListingCard";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { EmptyState, RowSkeletons, SectionCard, StatusPill } from "@/components/console/primitives";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useSession";
import { useRequireDeveloper } from "@/hooks/useRequireDeveloper";
import { supabase } from "@/integrations/supabase/client";
import { readinessScore } from "@/lib/console";
import { useMyListings } from "@/lib/console.queries";
import { kindLabel } from "@/lib/portal";
import { hasProAccess } from "@/lib/pro-access";
import { PUBLISHER_MONTHLY_PRICE_MWK } from "@/lib/monetization";
import { startPublisherCheckout } from "@/lib/payments.functions";

export const Route = createFileRoute("/_authenticated/console/publishing")({
  head: () => ({
    meta: [
      { title: "Publishing, Developer Console" },
      {
        name: "description",
        content: "Manage your product review pipeline and per-listing publishing coverage on the Malawian App Store.",
      },
      { property: "og:title", content: "Publishing, Developer Console" },
      { property: "og:description", content: "Your review and release pipeline." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublishingPage,
});

const STAGES = [
  { key: "draft", label: "Drafts", hint: "Complete the checklist, then submit." },
  { key: "pending", label: "In review", hint: "With the store review team." },
  { key: "published", label: "Live", hint: "Visible to everyone while publishing coverage is active." },
  { key: "rejected", label: "Needs changes", hint: "Fix the issues and resubmit." },
] as const;

type PublicationEntitlement = {
  listing_id: string;
  status: string;
  current_period_end: string | null;
};

function PublishingPage() {
  useRequireDeveloper();
  const { userId } = useProfile();
  const queryClient = useQueryClient();
  const listingsQuery = useMyListings(userId);
  const listings = listingsQuery.data ?? [];

  const subscriptionQuery = useQuery({
    queryKey: ["subscription", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("subscriptions")
        .select("plan,status,current_period_end,included_listing_id")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const publicationQuery = useQuery({
    queryKey: ["listing-publication-subscriptions", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("listing_publication_subscriptions")
        .select("listing_id,status,current_period_end")
        .eq("developer_id", userId!);
      if (error) throw error;
      return (data ?? []) as PublicationEntitlement[];
    },
  });

  const startCheckout = useServerFn(startPublisherCheckout);
  const checkout = useMutation({
    mutationFn: (listingId: string) => startCheckout({ data: { listingId } }),
    onSuccess: async (result) => {
      if ("checkoutUrl" in result && result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      if ("included" in result && result.included) toast.success("Your Developer Pro plan covers this listing.");
      else if ("pendingPublication" in result && result.pendingPublication) toast.success("Payment received. Your 30-day publishing period starts when the listing goes live.");
      else toast.success("This listing already has active publishing coverage.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["subscription", userId] }),
        queryClient.invalidateQueries({ queryKey: ["listing-publication-subscriptions", userId] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const proActive = hasProAccess(subscriptionQuery.data);
  const includedListingId = subscriptionQuery.data?.included_listing_id ?? null;
  const publicationRows = publicationQuery.data ?? [];
  const loadingEntitlements = subscriptionQuery.isLoading || publicationQuery.isLoading;

  return (
    <ConsoleShell
      title="Publishing"
      description="Every product, grouped by where it sits in the review pipeline."
      breadcrumbs={[{ label: "Console", to: "/console" }, { label: "Publishing" }]}
      actions={<Button asChild className="rounded-full"><Link to="/upload">New product</Link></Button>}
    >
      <section className="mb-4 rounded-xl border border-border bg-background p-4">
        <p className="text-sm font-semibold">Publishing fees</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Developer accounts are free. Publisher costs MK{PUBLISHER_MONTHLY_PRICE_MWK.toLocaleString("en")} per published listing per month.
          Developer Pro at MK5,000/month includes one published listing; additional listings remain MK1,000 each per month.
        </p>
        <Link to="/console/subscription" className="mt-2 inline-flex text-sm font-medium text-primary hover:underline">Compare Developer Pro benefits</Link>
      </section>

      {listingsQuery.isLoading ? <RowSkeletons count={4} /> : listings.length === 0 ? (
        <EmptyState
          icon={Rocket}
          title="Nothing in the pipeline yet"
          description="Start a listing and it will appear here as it moves through review."
          action={<Button asChild className="rounded-full"><Link to="/upload">Start a listing</Link></Button>}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {STAGES.map((stage) => {
            const rows = listings.filter((listing) => listing.status === stage.key);
            return (
              <SectionCard key={stage.key} title={`${stage.label} (${rows.length})`}>
                <p className="-mt-1 mb-3 text-sm text-muted-foreground">{stage.hint}</p>
                {rows.length === 0 ? <p className="text-sm text-muted-foreground">No products at this stage.</p> : (
                  <ul className="divide-y divide-border">
                    {rows.map((listing) => {
                      const publication = publicationRows.find((row) => row.listing_id === listing.id);
                      const publicationActive = publication?.status === "active" && Date.parse(publication.current_period_end ?? "") > Date.now();
                      const publicationPending = publication?.status === "paid_pending";
                      const proIncluded = proActive && includedListingId === listing.id;
                      const covered = publicationActive || proIncluded;
                      const canPay = !covered && !publicationPending && !loadingEntitlements;
                      const useProSlot = proActive && !includedListingId && !publicationPending;
                      return (
                        <li key={listing.id} className="py-3">
                          <div className="flex items-center gap-3">
                            <Link to="/console/products/$id" params={{ id: listing.id }} className="flex min-w-0 flex-1 items-center gap-3">
                              <AppIcon path={listing.icon_url} name={listing.name} className="h-10 w-10 rounded-xl" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{listing.name}</p>
                                <p className="text-xs text-muted-foreground">{kindLabel(listing.kind)} · {readinessScore(listing)}% ready</p>
                              </div>
                              <StatusPill status={listing.status} />
                            </Link>
                          </div>
                          <div className="ml-[52px] mt-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs text-muted-foreground">
                              {proIncluded ? "Included with Developer Pro" : publicationActive
                                ? `Publisher active until ${new Date(publication!.current_period_end!).toLocaleDateString()}`
                                : publicationPending ? "Payment received · waiting for publication" : "Publishing coverage required"}
                            </p>
                            {canPay && (
                              <Button size="sm" variant="outline" disabled={checkout.isPending} onClick={() => checkout.mutate(listing.id)}>
                                {checkout.isPending ? "Preparing checkout…" : useProSlot ? "Use included Pro listing" : publication?.status === "active" ? "Renew · MK1,000" : "Pay MK1,000/month"}
                              </Button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </SectionCard>
            );
          })}
        </div>
      )}
    </ConsoleShell>
  );
}
