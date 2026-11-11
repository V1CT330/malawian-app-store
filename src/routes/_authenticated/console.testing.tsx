import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";

import { AppIcon } from "@/components/ListingCard";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { EmptyState, RowSkeletons, SectionCard, StatusPill } from "@/components/console/primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProfile } from "@/hooks/useSession";
import { useRequireDeveloper } from "@/hooks/useRequireDeveloper";
import { supabase } from "@/integrations/supabase/client";
import { useMyListings } from "@/lib/console.queries";
import { hasProAccess } from "@/lib/pro-access";

export const Route = createFileRoute("/_authenticated/console/testing")({
  head: () => ({
    meta: [
      { title: "Testing, Developer Console" },
      {
        name: "description",
        content:
          "Beta testers and tester feedback across every product you publish on the Malawian App Store.",
      },
      { property: "og:title", content: "Testing, Developer Console" },
      { property: "og:description", content: "Beta testers and feedback in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TestingPage,
});

function TestingPage() {
  useRequireDeveloper();
  const { userId } = useProfile();
  const listingsQuery = useMyListings(userId);
  const listings = listingsQuery.data ?? [];

  const subscription = useQuery({
    queryKey: ["subscription", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("plan,status,current_period_end")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const hasPro = hasProAccess(subscription.data);

  const testersQuery = useQuery({
    queryKey: ["console-testers", userId],
    enabled: Boolean(userId && hasPro),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beta_testers")
        .select("id,email,channel,status,listing_id,created_at")
        .eq("owner_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const testers = testersQuery.data ?? [];

  if (subscription.isLoading) {
    return <ConsoleShell title="Testing"><p className="text-sm text-muted-foreground">Checking Developer Pro access…</p></ConsoleShell>;
  }

  if (subscription.isError) {
    return (
      <ConsoleShell title="Testing">
        <SectionCard title="Unable to verify subscription">
          <p className="text-sm text-muted-foreground">We could not confirm your Developer Pro status. Retry before opening beta testing tools.</p>
          <Button className="mt-3" variant="outline" onClick={() => void subscription.refetch()}>Retry</Button>
        </SectionCard>
      </ConsoleShell>
    );
  }

  if (!hasPro) {
    return (
      <ConsoleShell title="Testing">
        <SectionCard title="Beta testing requires Developer Pro">
          <Badge variant="outline">Developer Pro feature</Badge>
          <p className="mt-2 text-sm text-muted-foreground">Upgrade to an active paid subscription to invite beta testers and manage testing channels.</p>
          <Button asChild className="mt-3"><Link to="/console/subscription">Upgrade to Developer Pro</Link></Button>
        </SectionCard>
      </ConsoleShell>
    );
  }

  const nameOf = (id: string) => listings.find((l) => l.id === id)?.name ?? "Product";

  return (
    <ConsoleShell
      title="Testing"
      description="Invite testers per product, then track who is on each channel."
      breadcrumbs={[{ label: "Console", to: "/console" }, { label: "Testing" }]}
    >
      <div className="space-y-6">
        <SectionCard title={`Testers (${testers.length})`}>
          {testersQuery.isLoading ? (
            <RowSkeletons count={3} />
          ) : testers.length === 0 ? (
            <EmptyState
              icon={FlaskConical}
              title="No testers invited yet"
              description="Open a product and invite testers to an internal or closed channel."
              action={
                <Button asChild variant="outline">
                  <Link to="/console/products">Open a product</Link>
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {testers.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {nameOf(t.listing_id)} · {t.channel} channel
                    </p>
                  </div>
                  <StatusPill status={t.status} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Products open for testing">
          {listingsQuery.isLoading ? (
            <RowSkeletons count={2} />
          ) : listings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Publish a product to start testing.</p>
          ) : (
            <ul className="divide-y divide-border">
              {listings.map((l) => (
                <li key={l.id}>
                  <Link
                    to="/console/products/$id"
                    params={{ id: l.id }}
                    className="flex items-center gap-3 py-3"
                  >
                    <AppIcon path={l.icon_url} name={l.name} className="h-10 w-10 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {testers.filter((t) => t.listing_id === l.id).length} testers
                      </p>
                    </div>
                    <StatusPill status={l.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </ConsoleShell>
  );
}
