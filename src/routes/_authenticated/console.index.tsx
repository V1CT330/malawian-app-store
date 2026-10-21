import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  LayoutList,
  PlusCircle,
  Rocket,
  TrendingUp,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { ConsoleShell } from "@/components/console/ConsoleShell";
import { DemoPreview } from "@/components/DemoPreview";
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

  const ratedListings = listings.filter((listing) => listing.rating_count > 0);
  const rating = ratedListings.reduce((total, listing) => total + Number(listing.rating_avg), 0) /
    Math.max(1, ratedListings.length);
  const reputation = reputationQuery.data ?? 0;
  const subscribed = subscriptionQuery.data?.status === "active";
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
  const listingStatusData = [
    { name: "Published", value: published.length, color: "var(--google-green)" },
    { name: "In review", value: pending.length, color: "var(--google-blue)" },
    { name: "Drafts", value: drafts.length, color: "var(--google-yellow)" },
    { name: "Rejected", value: rejected.length, color: "var(--google-red)" },
  ].filter((item) => item.value > 0);

  return (
    <ConsoleShell
      title={`Welcome back, ${profile?.developer_name || profile?.display_name || "developer"}`}
      description="Your publishing command centre. Check performance, fix blockers and manage releases."
      actions={
        <>
          <Button asChild variant="outline" className="rounded-none">
            <Link to="/console/products">
              <LayoutList className="mr-2 h-4 w-4" /> All products
            </Link>
          </Button>
          <Button asChild className="rounded-none">
            <Link to="/upload">
              <PlusCircle className="mr-2 h-4 w-4" /> New product
            </Link>
          </Button>
        </>
      }
    >
      {!listingsQuery.isLoading && listings.length === 0 && <DemoPreview title="Developer dashboard · sample view" description="Example metrics and tasks to show the dashboard once your account has products." items={[{ title: "Store visits", detail: "Views across your product pages.", metric: "3,840 · illustrative", status: "Last 30 days" }, { title: "Installs", detail: "Recorded install events from published products.", metric: "1,275 · illustrative", status: "Last 30 days" }, { title: "Publishing checklist", detail: "One draft needs screenshots and a support link.", metric: "80% ready", status: "Action needed" }, { title: "Developer reputation", detail: "A sample account health overview.", metric: "Strong · illustrative", status: "Preview" }]} />}
      <div className="dashboard-content-flat space-y-5 [&_.surface-card]:rounded-none">
        <section className="grid gap-0 border border-border bg-background md:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col justify-between gap-5 border-b border-border p-5 sm:p-6 md:border-b-0 md:border-r">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-none">DEVELOPER OVERVIEW</Badge>
                {subscribed && <Badge className="rounded-none">PRO ACTIVE</Badge>}
              </div>
              <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">Your store, at a glance</h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                A clear view of what is live, what needs work, and how people are finding your products.
              </p>
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
          <div className="grid grid-cols-2">
            {[
              { label: "Published", value: published.length, note: "Live listings" },
              { label: "In review", value: pending.length, note: "Awaiting review" },
              { label: "Drafts", value: drafts.length, note: "Not published" },
              { label: "Action needed", value: rejected.length + tasks.filter((task) => task.tone === "info").length, note: "Fix or complete" },
            ].map((item, index) => (
              <div key={item.label} className={`p-4 sm:p-5 ${index % 2 === 0 ? "border-r" : ""} ${index < 2 ? "border-b" : ""} border-border`}>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
                <p className="mt-2 font-display text-3xl font-bold tabular-nums">{listingsQuery.isLoading ? "—" : item.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {statsQuery.isLoading ? <TileSkeletons /> : (
            <>
              <MetricTile label="Installs (30d)" value={installs.toLocaleString("en")} delta={percentDelta(currentInstalls, previousInstalls)} hint="Recorded installs" />
              <MetricTile label="Store views (30d)" value={views.toLocaleString("en")} delta={percentDelta(currentViews, previousViews)} hint="Product page visits" />
              <MetricTile label="View-to-install" value={`${conversion(stats)}%`} delta={percentDelta(currentConversion, previousConversion)} hint="Views that convert" />
              <MetricTile label="Average rating" value={Number.isFinite(rating) && rating > 0 ? rating.toFixed(1) : "N/A"} hint={`${listings.reduce((total, listing) => total + listing.rating_count, 0)} ratings`} />
            </>
          )}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
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

          <SectionCard title="Listing breakdown">
            <p className="mb-3 text-xs text-muted-foreground">Actual listings grouped by their current publishing status.</p>
            {listingsQuery.isLoading ? (
              <div className="h-48 animate-pulse bg-muted" />
            ) : listingStatusData.length === 0 ? (
              <div className="flex min-h-40 items-center justify-center text-center text-sm text-muted-foreground">Your listing breakdown will appear after you create a product.</div>
            ) : (
              <>
                <div className="relative h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={listingStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={76} paddingAngle={3} stroke="none">
                        {listingStatusData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-display text-2xl font-bold tabular-nums">{listings.length}</span>
                    <span className="text-xs text-muted-foreground">Products</span>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  {listingStatusData.map((item) => (
                    <div key={item.name} className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="min-w-0 flex-1 text-muted-foreground">{item.name}</span>
                      <strong className="tabular-nums">{item.value}</strong>
                    </div>
                  ))}
                </div>
              </>
            )}
          </SectionCard>

          <SectionCard title="Publishing health">
            {listingsQuery.isLoading ? <RowSkeletons count={2} /> : listings.length === 0 ? (
              <EmptyState icon={Rocket} title="Start publishing" description="Create your first product listing to begin building your store presence." action={<Button asChild className="rounded-none"><Link to="/upload">Create listing</Link></Button>} />
            ) : (
              <div className="space-y-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-3xl font-bold tabular-nums">{Math.round((liveReady / Math.max(1, published.length)) * 100)}%</p>
                    <p className="text-xs text-muted-foreground">Published listings at full readiness</p>
                  </div>
                  <span className="text-sm text-muted-foreground">{liveReady}/{published.length} live</span>
                </div>
                <Progress value={published.length ? (liveReady / published.length) * 100 : 0} />
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

        <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
          <SectionCard title="Products" action={<Button asChild size="sm" variant="ghost" className="rounded-none"><Link to="/console/products">Manage all <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>}>
            {listingsQuery.isLoading ? <RowSkeletons /> : listings.length === 0 ? (
              <EmptyState icon={LayoutList} title="Publish your first product" description="Apps, websites, AI agents and browser extensions are all welcome." action={<Button asChild className="rounded-none"><Link to="/upload">Start a listing</Link></Button>} />
            ) : (
              <ul className="divide-y divide-border">
                {listings.slice(0, 5).map((listing) => (
                  <li key={listing.id}>
                    <Link to="/console/products/$id" params={{ id: listing.id }} className="flex items-center gap-3 py-3 hover:bg-muted/40">
                      <img src={listing.icon_url ?? "/favicon.png"} alt="" className="h-11 w-11 rounded-none border border-border object-cover" />
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

          <div className="space-y-5">
            <SectionCard title="Needs your attention" action={<Badge variant="outline" className="rounded-none">{tasks.length} items</Badge>}>
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
              <div className="flex items-end justify-between gap-3">
                <p className="font-display text-3xl font-bold tabular-nums">{reputation}<span className="ml-1 text-sm font-normal text-muted-foreground">/100</span></p>
                <p className="text-xs text-muted-foreground">Quality · ratings · updates</p>
              </div>
              <Progress value={reputation} className="mt-3" />
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
