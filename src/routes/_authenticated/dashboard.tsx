import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, PlusCircle } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { GeminiIcon } from "@/components/GeminiIcon";
import { PortalTabs } from "@/components/PortalTabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile, useUnreadCount } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { kindLabel, reputationTier, type PortalListing } from "@/lib/portal";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Developer Dashboard — Malawian App Store" },
      {
        name: "description",
        content: "Products, installs, views, ratings, reviews and account status for everything you publish.",
      },
      { property: "og:title", content: "Developer Dashboard — Malawian App Store" },
      { property: "og:description", content: "Your publishing overview at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="surface-card p-3 text-center">
      <p className="font-display text-xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function DashboardPage() {
  const { userId, profile } = useProfile();
  const unread = useUnreadCount();

  const listingsQuery = useQuery({
    queryKey: ["my-listings", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("developer_id", userId!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PortalListing[];
    },
  });

  const listings = listingsQuery.data ?? [];

  const reputationQuery = useQuery({
    queryKey: ["reputation", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("compute_reputation", { _developer: userId! });
      if (error) throw error;
      return Number(data ?? 0);
    },
  });

  const subscriptionQuery = useQuery({
    queryKey: ["subscription", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("status,current_period_end")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const published = listings.filter((l) => l.status === "published");
  const pending = listings.filter((l) => l.status === "pending");
  const drafts = listings.filter((l) => l.status === "draft");
  const stale = published.filter((l) => Date.now() - new Date(l.updated_at).getTime() > 1000 * 60 * 60 * 24 * 90);
  const reputation = reputationQuery.data ?? 0;
  const subscribed = subscriptionQuery.data?.status === "active";

  return (
    <AppShell>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Developer portal</h1>
          <p className="text-sm text-muted-foreground">
            {profile?.developer_name || profile?.display_name || "Your account"}
          </p>
        </div>
        {profile?.kyc_status === "approved" ? (
          <Badge className="gap-1">
            <BadgeCheck className="h-3.5 w-3.5" /> Verified
          </Badge>
        ) : (
          <Badge variant="secondary" className="capitalize">
            KYC {profile?.kyc_status ?? "none"}
          </Badge>
        )}
      </header>

      <div className="mt-4">
        <PortalTabs />
      </div>

      {listingsQuery.isLoading ? (
        <Skeleton className="h-28 w-full rounded-2xl" />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            <Stat value={listings.length} label="products" />
            <Stat value={published.length} label="published" />
            <Stat value={pending.length} label="in review" />
            <Stat value={drafts.length} label="drafts" />
            <Stat value={unread} label="notifications" />
          </div>

          <section className="surface-card mt-4 p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold">Reputation</h2>
              <Badge variant="secondary">{reputationTier(reputation)}</Badge>
            </div>
            <Progress value={reputation} className="mt-3" />
            <p className="mt-2 text-xs text-muted-foreground">
              {reputation}/100 from product quality, ratings, update frequency, compliance, profile completeness and
              responsiveness.
            </p>
          </section>

          <section className="surface-card mt-4 p-4">
            <h2 className="font-display text-base font-semibold">Account status</h2>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>Subscription: {subscribed ? "Active — MK5,000 monthly" : "Not subscribed"}</li>
              <li>KYC: {profile?.kyc_status ?? "none"}</li>
              <li>Phone verified: {profile?.phone_verified ? "yes" : "no"}</li>
              <li>Updates needed: {stale.length ? `${stale.length} product(s) not updated in 90 days` : "none"}</li>
            </ul>
            {!subscribed && (
              <Button asChild size="sm" className="mt-3">
                <Link to="/settings">Subscribe to unlock premium tools</Link>
              </Button>
            )}
          </section>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Button asChild className="justify-start" size="lg">
              <Link to="/upload">
                <PlusCircle className="mr-2 h-4 w-4" /> New product
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start" size="lg">
              <Link to="/assistant">
                <GeminiIcon className="mr-2 h-4 w-4" /> AI publishing assistant
              </Link>
            </Button>
          </div>

        </>
      )}
    </AppShell>
  );
}
