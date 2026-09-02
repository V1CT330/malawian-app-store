import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, LayoutList, PlusCircle, Sparkles } from "lucide-react";

import { ConsoleShell } from "@/components/console/ConsoleShell";
import {
  EmptyState,
  MetricTile,
  RowSkeletons,
  SectionCard,
  StatusPill,
  TileSkeletons,
} from "@/components/console/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useProfile } from "@/hooks/useSession";
import { useRequireDeveloper } from "@/hooks/useRequireDeveloper";
import { supabase } from "@/integrations/supabase/client";
import { conversion, sum, useDeveloperStats, useMyListings } from "@/lib/console.queries";
import { metricLabel, readinessScore } from "@/lib/console";
import { reputationTier } from "@/lib/portal";

export const Route = createFileRoute("/_authenticated/console/")({
  head: () => ({
    meta: [
      { title: "Developer Console — Malawian App Store" },
      {
        name: "description",
        content:
          "Your publishing overview: what needs attention, installs and visits over the last 30 days, and every product you run.",
      },
      { property: "og:title", content: "Developer Console — Malawian App Store" },
      { property: "og:description", content: "Publishing overview for Malawian developers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConsoleDashboard,
});

function ConsoleDashboard() {
  useRequireDeveloper();
  const { userId, profile } = useProfile();
  const listingsQuery = useMyListings(userId);
  const statsQuery = useDeveloperStats(userId, 30);
  const listings = listingsQuery.data ?? [];
  const stats = statsQuery.data ?? [];

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

  const rating =
    listings.filter((l) => l.rating_count > 0).reduce((a, l) => a + Number(l.rating_avg), 0) /
    Math.max(1, listings.filter((l) => l.rating_count > 0).length);

  const reputation = reputationQuery.data ?? 0;
  const subscribed = subscriptionQuery.data?.status === "active";

  type Task = { key: string; text: string; to: string; tone: "warn" | "info" };
  const tasks: Task[] = [];
  for (const l of listings) {
    if (l.status === "rejected")
      tasks.push({
        key: `rej-${l.id}`,
        text: `${l.name} was rejected. Fix the issues and resubmit.`,
        to: l.id,
        tone: "warn",
      });
    else if (l.status === "draft" && readinessScore(l) < 100)
      tasks.push({
        key: `draft-${l.id}`,
        text: `${l.name} is an incomplete draft (${readinessScore(l)}% ready).`,
        to: l.id,
        tone: "info",
      });
  }

  return (
    <ConsoleShell
      title={`Welcome back, ${profile?.developer_name || profile?.display_name || "developer"}`}
      description="Everything you publish on the Malawian App Store, in one place."
      actions={
        <>
          <Button asChild variant="outline">
            <Link to="/console/products">
              <LayoutList className="mr-2 h-4 w-4" /> All products
            </Link>
          </Button>
          <Button asChild>
            <Link to="/upload">
              <PlusCircle className="mr-2 h-4 w-4" /> New product
            </Link>
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <SectionCard title="Needs your attention">
          {listingsQuery.isLoading ? (
            <RowSkeletons count={2} />
          ) : tasks.length === 0 ? (
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-brand-green" />
              <div>
                <p className="text-sm font-medium">You are all caught up</p>
                <p className="text-sm text-muted-foreground">
                  Nothing is blocked. Improve your store presence next.
                </p>
                <Button asChild size="sm" variant="outline" className="mt-3">
                  <Link to="/console/quality">
                    <Sparkles className="mr-2 h-4 w-4" /> Review listing quality
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {tasks.slice(0, 6).map((t) => (
                <li key={t.key}>
                  <Link
                    to="/console/products/$id"
                    params={{ id: t.to }}
                    className="flex items-center gap-3 py-3 text-sm hover:text-primary"
                  >
                    <AlertTriangle
                      className={
                        t.tone === "warn" ? "h-4 w-4 shrink-0 text-brand-red" : "h-4 w-4 shrink-0 text-muted-foreground"
                      }
                    />
                    <span className="min-w-0 flex-1">{t.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {statsQuery.isLoading ? (
          <TileSkeletons />
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricTile label="Installs and visits (30d)" value={sum(stats, "installs")} />
            <MetricTile label="Store views (30d)" value={sum(stats, "views")} />
            <MetricTile label="Conversion" value={`${conversion(stats)}%`} hint="Views that convert" />
            <MetricTile
              label="Average rating"
              value={Number.isFinite(rating) && rating > 0 ? rating.toFixed(1) : "—"}
              hint={`${listings.reduce((a, l) => a + l.rating_count, 0)} ratings`}
            />
          </div>
        )}

        <SectionCard
          title="Products"
          action={
            <Button asChild size="sm" variant="ghost">
              <Link to="/console/products">View all</Link>
            </Button>
          }
        >
          {listingsQuery.isLoading ? (
            <RowSkeletons />
          ) : listings.length === 0 ? (
            <EmptyState
              icon={LayoutList}
              title="Publish your first product"
              description="Apps, websites, AI agents and browser extensions are all welcome."
              action={
                <Button asChild>
                  <Link to="/upload">Start a listing</Link>
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {listings.slice(0, 4).map((l) => (
                <li key={l.id}>
                  <Link
                    to="/console/products/$id"
                    params={{ id: l.id }}
                    className="flex items-center gap-3 py-3"
                  >
                    <img
                      src={l.icon_url ?? "/favicon.png"}
                      alt=""
                      className="h-10 w-10 rounded-xl object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.downloads} {metricLabel(l.kind)} · {l.rating_count} ratings
                      </p>
                    </div>
                    <StatusPill status={l.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="Reputation" action={<Badge variant="secondary">{reputationTier(reputation)}</Badge>}>
            <Progress value={reputation} />
            <p className="mt-2 text-xs text-muted-foreground">
              {reputation}/100 from product quality, ratings, update frequency, compliance and
              responsiveness.
            </p>
          </SectionCard>
          <SectionCard title="Developer Pro">
            <p className="text-sm text-muted-foreground">
              {subscribed
                ? `Active. Renews ${subscriptionQuery.data?.current_period_end?.slice(0, 10) ?? "monthly"}.`
                : "MK5,000 per month unlocks priority review, advanced analytics and the AI assistant."}
            </p>
            <Button asChild size="sm" variant={subscribed ? "outline" : "default"} className="mt-3">
              <Link to="/console/subscription">{subscribed ? "Manage subscription" : "Upgrade to Pro"}</Link>
            </Button>
          </SectionCard>
        </div>
      </div>
    </ConsoleShell>
  );
}
