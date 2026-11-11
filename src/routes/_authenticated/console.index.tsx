import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Rocket,
  TrendingUp,
} from "lucide-react";
import { ResponsiveContainer, Tooltip, Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { AppIcon } from "@/components/ListingCard";
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
import { useProfile } from "@/hooks/useSession";
import { useRequireDeveloper } from "@/hooks/useRequireDeveloper";
import { supabase } from "@/integrations/supabase/client";
import { hasProAccess } from "@/lib/pro-access";
import { conversion, sum, useDeveloperStats, useMyListings } from "@/lib/console.queries";
import { metricLabel, readinessScore } from "@/lib/console";
import { reputationTier } from "@/lib/portal";

export const Route = createFileRoute("/_authenticated/console/")({
  head: () => ({
    meta: [
      { title: "Developer Console, Malawian App Store" },
      {
        name: "description",
        content:
          "Your publishing overview: what needs attention, installs and visits over the last 30 days, and every product you run.",
      },
      { property: "og:title", content: "Developer Console, Malawian App Store" },
      { property: "og:description", content: "Publishing overview for Malawian developers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConsoleDashboard,
});

function LinearGauge({ value, label }: { value: number; label: string }) {
  const safeValue = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

  return (
    <div className="w-full min-w-0">
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{Math.round(safeValue)}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(safeValue)}
        className="h-2 w-full overflow-hidden bg-muted"
      >
        <div
          className="h-full bg-brand-green transition-[width] duration-500"
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}

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
        .select("plan,status,current_period_end")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const ratedListings = listings.filter((listing) => listing.rating_count > 0);
  const rating = ratedListings.reduce((total, listing) => total + Number(listing.rating_avg), 0) /
    Math.max(1, ratedListings.length);
  const reputation = reputationQuery.data ?? 0;
  const subscribed = hasProAccess(subscriptionQuery.data);
  const published = listings.filter((listing) => listing.status === "published");
  const drafts = listings.filter((listing) => listing.status === "draft");
  const pending = listings.filter((listing) => listing.status === "pending");
  const rejected = listings.filter((listing) => listing.status === "rejected");
  const liveReady = listings.filter((listing) => listing.status === "published" && readinessScore(listing) === 100).length;

  type Task = { key: string; text: string; to: string; tone: "warn" | "info" };
  const tasks: Task[] = [];
  for (const listing of listings) {
    if (listing.status === "rejected") {
      tasks.push({
        key: `rej-${listing.id}`,
        text: `${listing.name} was rejected. Fix the issues and resubmit.`,
        to: listing.id,
        tone: "warn",
      });
    } else if (listing.status === "draft" && readinessScore(listing) < 100) {
      tasks.push({
        key: `draft-${listing.id}`,
        text: `${listing.name} is an incomplete draft (${readinessScore(listing)}% ready).`,
        to: listing.id,
        tone: "info",
      });
    }
  }

  const recentStats = stats.slice(-14);
  const views = sum(stats, "views");
  const installs = sum(stats, "installs");
  const currentPeriod = stats.slice(-14);
  const previousPeriod = stats.slice(-28, -14);
  const currentViews = sum(currentPeriod, "views");
  const previousViews = sum(previousPeriod, "views");
  const currentInstalls = sum(currentPeriod, "installs");
  const previousInstalls = sum(previousPeriod, "installs");
  const currentConversion = currentViews ? (currentInstalls / currentViews) * 100 : 0;
  const previousConversion = previousViews ? (previousInstalls / previousViews) * 100 : 0;
  const percentDelta = (current: number, previous: number): number | null => {
    if (previous === 0) return current === 0 ? null : 100;
    return Math.round(((current - previous) / previous) * 100);
  };

  return (
    <ConsoleShell hideTitleCard>
      <div className="dashboard-content-flat space-y-2">
        <section className="grid border-b border-border/80 bg-background md:grid-cols-[1.35fr_1fr]">
          <div className="flex flex-col justify-between gap-5 border-b border-border/80 px-1 py-5 sm:py-6 md:border-b-0 md:border-r md:pr-7">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Developer console</span>
                {subscribed && <Badge className="rounded-none">PRO ACTIVE</Badge>}
              </div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-[28px]">Overview</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild className="rounded-none">
                <Link to="/upload"><Rocket className="mr-2 h-4 w-4" /> Publish a product</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-none">
                <Link to="/console/analytics"><BarChart3 className="mr-2 h-4 w-4" /> Open analytics</Link>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 bg-background md:pl-2">
            {[
              { label: "Published", value: published.length, note: "Live listings" },
              { label: "In review", value: pending.length, note: "Awaiting review" },
              { label: "Drafts", value: drafts.length, note: "Not published" },
              { label: "Action needed", value: rejected.length + tasks.filter((task) => task.tone === "info").length, note: "Fix or complete" },
            ].map((item, index) => (
              <div key={item.label} className={`px-4 py-4 sm:px-5 sm:py-5 ${index % 2 === 0 ? "border-r" : ""} ${index < 2 ? "border-b" : ""} border-border/80`}>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
                <p className={`mt-2 font-display text-3xl font-bold tabular-nums ${item.label === "Published" ? "text-brand-green" : item.label === "In review" ? "text-amber-600 dark:text-amber-400" : item.label === "Action needed" ? (item.value > 0 ? "text-brand-red" : "text-brand-green") : "text-foreground"}`}>{listingsQuery.isLoading ? "—" : item.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
              </div>
            ))}
          </div>
        </section>

        {(listingsQuery.isError || statsQuery.isError || reputationQuery.isError || subscriptionQuery.isError) && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
            <span className="font-medium">Some dashboard information could not be loaded.</span>
            <span className="text-xs text-muted-foreground">Displayed figures may be incomplete. Refresh the page or try again shortly.</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-5 gap-y-2 border-b border-border/80 py-2 sm:grid-cols-4 sm:gap-6">
          {statsQuery.isLoading ? <TileSkeletons /> : (
            <>
              <MetricTile label="Installs (30d)" value={installs.toLocaleString("en")} delta={percentDelta(currentInstalls, previousInstalls)} hint="Recorded installs" />
              <MetricTile label="Store views (30d)" value={views.toLocaleString("en")} delta={percentDelta(currentViews, previousViews)} hint="Product page visits" />
              <MetricTile label="View-to-install" value={`${conversion(stats)}%`} delta={percentDelta(currentConversion, previousConversion)} hint="Views that convert" />
              <MetricTile label="Average rating" value={Number.isFinite(rating) && rating > 0 ? rating.toFixed(1) : "N/A"} hint={`${listings.reduce((total, listing) => total + listing.rating_count, 0)} ratings`} />
            </>
          )}
        </div>

        <div className="grid gap-x-8 xl:grid-cols-[1.6fr_1fr]">
          <SectionCard
            title="Performance over the last 30 days"
            action={<Button asChild size="sm" variant="ghost" className="rounded-none"><Link to="/console/analytics">Detailed analytics <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>}
          >
            {statsQuery.isLoading ? (
              <div className="h-44 animate-pulse bg-muted" />
            ) : stats.length === 0 || (views === 0 && installs === 0) ? (
              <div className="flex min-h-40 flex-col items-center justify-center border border-dashed border-border px-4 py-8 text-center">
                <TrendingUp className="mb-2 h-5 w-5 text-muted-foreground" />
                <p className="text-sm font-medium">Performance data will appear here</p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">Views and installs are shown as events are recorded. Open analytics to explore the available reports.</p>
                <Button asChild size="sm" variant="outline" className="mt-3 rounded-none"><Link to="/console/analytics">View analytics</Link></Button>
              </div>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-2"><span className="h-2 w-2 bg-[var(--google-blue)]" /> Views</span>
                  <span className="inline-flex items-center gap-2"><span className="h-2 w-2 bg-[var(--google-green)]" /> Installs</span>
                </div>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={recentStats} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
                      <XAxis dataKey="day" fontSize={10} minTickGap={18} />
                      <YAxis fontSize={10} allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="views" name="Views" stroke="var(--google-blue)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      <Line type="monotone" dataKey="installs" name="Installs" stroke="var(--google-green)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </SectionCard>

          <SectionCard title="Publishing health">
            {listingsQuery.isLoading ? <RowSkeletons count={2} /> : listings.length === 0 ? (
              <EmptyState icon={Rocket} title="Start publishing" description="Create your first product listing to begin building your store presence." action={<Button asChild className="rounded-none"><Link to="/upload">Create listing</Link></Button>} />
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <LinearGauge
                    value={published.length ? (liveReady / published.length) * 100 : 0}
                    label="Publishing readiness"
                  />
                  <p className="text-xs text-muted-foreground">
                    {liveReady} of {published.length} live listings meet every readiness check.
                  </p>
                </div>
                <div className="divide-y divide-border border-y border-border">
                  <div className="flex items-center justify-between py-3 text-sm"><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-brand-green" /> Published</span><strong>{published.length}</strong></div>
                  <div className="flex items-center justify-between py-3 text-sm"><span className="flex items-center gap-2"><Rocket className="h-4 w-4 text-muted-foreground" /> In review</span><strong>{pending.length}</strong></div>
                  <div className="flex items-center justify-between py-3 text-sm"><span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-muted-foreground" /> Drafts / rejected</span><strong>{drafts.length + rejected.length}</strong></div>
                </div>
                <Button asChild variant="outline" className="w-full rounded-none"><Link to="/console/quality">Review listing quality <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
              </div>
            )}
          </SectionCard>
        </div>

        <div className="grid gap-x-8 xl:grid-cols-[1.35fr_1fr]">
          <SectionCard title="Products" action={<Button asChild size="sm" variant="ghost" className="rounded-none"><Link to="/console/products">Manage all <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>}>
            {listingsQuery.isLoading ? <RowSkeletons /> : listings.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 py-2"><div><p className="text-sm font-medium">No products yet</p><p className="mt-1 text-xs text-muted-foreground">Publish an app, website, AI agent or browser extension to start building your store.</p></div><Button asChild size="sm" className="rounded-none"><Link to="/upload">Create product <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div>
            ) : (
              <ul className="divide-y divide-border">
                {listings.slice(0, 5).map((listing) => (
                  <li key={listing.id}>
                    <Link to="/console/products/$id" params={{ id: listing.id }} className="flex items-center gap-3 py-3.5 hover:bg-muted/30">
                      <AppIcon path={listing.icon_url} name={listing.name} className="h-11 w-11 rounded-xl" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{listing.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{listing.downloads} {metricLabel(listing.kind)} · {listing.rating_count} ratings</p>
                      </div>
                      <StatusPill status={listing.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <div className="space-y-1">
            <SectionCard title="Needs your attention" action={<Badge variant="outline" className={`rounded-none ${tasks.length > 0 ? "border-brand-red/40 bg-brand-red/10 text-brand-red" : "border-brand-green/40 bg-brand-green/10 text-brand-green"}`}>{tasks.length} {tasks.length === 1 ? "item" : "items"}</Badge>}>
              {listingsQuery.isLoading ? <RowSkeletons count={2} /> : tasks.length === 0 ? (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-green" />
                  <div>
                    <p className="text-sm font-medium">You are all caught up</p>
                    <p className="mt-1 text-sm text-muted-foreground">Nothing is blocked. Keep your listings complete and up to date.</p>
                  </div>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {tasks.slice(0, 5).map((task) => (
                    <li key={task.key}>
                      <Link to="/console/products/$id" params={{ id: task.to }} className="flex items-start gap-3 py-3 text-sm hover:text-primary">
                        <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${task.tone === "warn" ? "text-brand-red" : "text-muted-foreground"}`} />
                        <span className="min-w-0 flex-1">{task.text}</span>
                        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="Developer reputation" action={<Badge variant="secondary" className="rounded-none">{reputationTier(reputation)}</Badge>}>
              <div className="space-y-2">
                <p className="font-display text-lg font-semibold tabular-nums">
                  {reputation}<span className="ml-1 text-xs font-normal text-muted-foreground">/100</span>
                </p>
                <LinearGauge value={reputation} label="Developer reputation" />
                <p className="text-xs text-muted-foreground">Quality · ratings · updates</p>
              </div>
            </SectionCard>

            <SectionCard title="Developer Pro" action={subscribed ? <Badge className="rounded-none">Active</Badge> : <Badge variant="outline" className="rounded-none">Optional</Badge>}>
              <p className="text-sm text-muted-foreground">
                {subscribed
                  ? `Your subscription is active. Renews ${subscriptionQuery.data?.current_period_end?.slice(0, 10) ?? "monthly"}.`
                  : "MK5,000 per month unlocks priority review, advanced analytics and the AI assistant."}
              </p>
              <Button asChild size="sm" variant={subscribed ? "outline" : "default"} className="mt-3 w-full rounded-none">
                <Link to="/console/subscription">{subscribed ? "Manage subscription" : "Explore Developer Pro"}</Link>
              </Button>
            </SectionCard>
          </div>
        </div>
      </div>
    </ConsoleShell>
  );
}
