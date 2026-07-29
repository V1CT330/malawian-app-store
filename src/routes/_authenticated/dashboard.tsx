import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, Bot, PlusCircle, TrendingUp } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { ListingCard } from "@/components/ListingCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { type Listing } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Developer Dashboard — Malawian App Store" },
      {
        name: "description",
        content: "Track installs, ratings and listing status for the apps and websites you publish.",
      },
      { property: "og:title", content: "Developer Dashboard — Malawian App Store" },
      { property: "og:description", content: "Track installs, ratings and listing status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { userId, profile } = useProfile();

  const { data, isLoading } = useQuery({
    queryKey: ["my-listings", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("developer_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Listing[];
    },
  });

  const listings = data ?? [];
  const installs = listings.reduce((sum, l) => sum + l.downloads, 0);
  const reviews = listings.reduce((sum, l) => sum + l.rating_count, 0);
  const avg =
    reviews > 0
      ? listings.reduce((sum, l) => sum + l.rating_avg * l.rating_count, 0) / reviews
      : 0;

  return (
    <AppShell>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Dashboard</h1>
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

      <div className="mb-4 grid grid-cols-3 gap-3 text-center">
        <div className="surface-card p-3">
          <p className="font-display text-xl font-bold">{installs}</p>
          <p className="text-xs text-muted-foreground">installs</p>
        </div>
        <div className="surface-card p-3">
          <p className="font-display text-xl font-bold">{listings.length}</p>
          <p className="text-xs text-muted-foreground">listings</p>
        </div>
        <div className="surface-card p-3">
          <p className="font-display text-xl font-bold">{avg ? avg.toFixed(1) : "—"}</p>
          <p className="text-xs text-muted-foreground">{reviews} reviews</p>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Button asChild className="justify-start" size="lg">
          <Link to="/upload">
            <PlusCircle className="mr-2 h-4 w-4" /> New listing
          </Link>
        </Button>
        <Button asChild variant="outline" className="justify-start" size="lg">
          <Link to="/assistant">
            <Bot className="mr-2 h-4 w-4" /> Ask the AI agent
          </Link>
        </Button>
      </div>

      <section>
        <h2 className="mb-2 flex items-center gap-1.5 font-display text-base font-semibold">
          <TrendingUp className="h-4 w-4" /> Your listings
        </h2>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        ) : listings.length === 0 ? (
          <div className="surface-card p-6 text-center text-sm text-muted-foreground">
            You haven't published anything yet.
          </div>
        ) : (
          <div className="space-y-3">
            {listings.map((l) => (
              <div key={l.id} className="space-y-1">
                <ListingCard listing={l} />
                <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
                  <span className="capitalize">Status: {l.status}</span>
                  <Link
                    to="/manage/$id"
                    params={{ id: l.id }}
                    className="font-medium text-primary underline"
                  >
                    Manage & update
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
