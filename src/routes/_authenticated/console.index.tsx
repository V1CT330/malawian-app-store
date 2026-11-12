import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Rocket,
  TrendingUp,
} from "lucide-react";
import { ResponsiveContainer, Tooltip, Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { AppIcon } from "@/components/ListingCard";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { StatusPill } from "@/components/console/primitives";
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

  return (
    <ConsoleShell hideTitleCard>
      <div className="console-dashboard-only dashboard-content-flat space-y-6">
        <section className="dashboard-welcome">
          <div className="min-w-0">
            <p className="dashboard-eyebrow">DEVELOPER WORKSPACE</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Your publishing overview</h2>
              {subscribed && <Badge className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300">Pro active</Badge>}
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Track your products, understand store performance and keep every publication moving.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="rounded-full px-5"><Link to="/upload"><Rocket className="mr-2 h-4 w-4" /> Publish a product</Link></Button>
            <Button asChild variant="outline" className="rounded-full px-5"><Link to="/console/analytics">View analytics <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>
        </section>

        {(listingsQuery.isError || statsQuery.isError || reputationQuery.isError || subscriptionQuery.isError) && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
            <span className="font-medium">Some dashboard information could not be loaded.</span>
            <span className="text-xs text-muted-foreground">Displayed figures may be incomplete. Refresh or try again shortly.</span>
          </div>
        )}

        <section aria-label="Publishing summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            { label: "Published", value: published.length, note: "Live in the store", accent: "green" },
            { label: "In review", value: pending.length, note: "Awaiting moderation", accent: "blue" },
            { label: "Drafts", value: drafts.length, note: "Not yet submitted", accent: "neutral" },
            { label: "Needs attention", value: rejected.length + tasks.filter((task) => task.tone === "info").length, note: "Fix or complete", accent: "amber" },
          ].map((item) => (
            <div key={item.label} className={`dashboard-stat dashboard-stat-${item.accent}`}>
              <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{listingsQuery.isLoading ? <span className="inline-block h-9 w-14 animate-pulse rounded-lg bg-muted" /> : item.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.85fr)]">
          <div className="dashboard-panel min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="dashboard-eyebrow">STORE PERFORMANCE</p><h3 className="mt-1 text-lg font-semibold tracking-tight">The last 30 days</h3><p className="mt-1 text-sm text-muted-foreground">Views and installs recorded across your products.</p></div>
              <Link to="/console/analytics" className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5">Full report <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {statsQuery.isLoading ? <div className="col-span-full grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div> : <>
                <div><p className="text-xs text-muted-foreground">Installs</p><p className="mt-1 text-xl font-semibold tabular-nums">{installs.toLocaleString("en")}</p><p className="text-xs text-muted-foreground">30-day total</p></div>
                <div><p className="text-xs text-muted-foreground">Store views</p><p className="mt-1 text-xl font-semibold tabular-nums">{views.toLocaleString("en")}</p><p className="text-xs text-muted-foreground">30-day total</p></div>
                <div><p className="text-xs text-muted-foreground">Conversion</p><p className="mt-1 text-xl font-semibold tabular-nums">{conversion(stats)}%</p><p className="text-xs text-muted-foreground">Views to installs</p></div>
                <div><p className="text-xs text-muted-foreground">Average rating</p><p className="mt-1 text-xl font-semibold tabular-nums">{Number.isFinite(rating) && rating > 0 ? rating.toFixed(1) : "N/A"}</p><p className="text-xs text-muted-foreground">{listings.reduce((total, listing) => total + listing.rating_count, 0)} ratings</p></div>
              </>}
            </div>
            <div className="mt-5 h-56 w-full">
              {statsQuery.isLoading ? <div className="h-full animate-pulse rounded-xl bg-muted/70" /> : stats.length === 0 || (views === 0 && installs === 0) ? (
                <div className="flex h-full flex-col items-center justify-center rounded-2xl bg-muted/40 px-5 text-center"><TrendingUp className="mb-2 h-6 w-6 text-muted-foreground" /><p className="text-sm font-medium">Performance data will appear here</p><p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">Views and installs will appear as people discover and use your products.</p></div>
              ) : (
                <ResponsiveContainer width="100%" height="100%"><LineChart data={recentStats} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} /><XAxis dataKey="day" fontSize={10} minTickGap={18} axisLine={false} tickLine={false} /><YAxis fontSize={10} allowDecimals={false} axisLine={false} tickLine={false} /><Tooltip /><Line type="monotone" dataKey="views" name="Views" stroke="var(--google-blue)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} /><Line type="monotone" dataKey="installs" name="Installs" stroke="var(--google-green)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} /></LineChart></ResponsiveContainer>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-5 text-xs text-muted-foreground"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[var(--google-blue)]" /> Views</span><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[var(--google-green)]" /> Installs</span></div>
          </div>

          <div className="dashboard-panel">
            <p className="dashboard-eyebrow">PUBLISHING HEALTH</p><h3 className="mt-1 text-lg font-semibold tracking-tight">Your catalogue</h3>
            {listingsQuery.isLoading ? <div className="mt-6 space-y-3"><div className="h-3 animate-pulse rounded-full bg-muted" /><div className="h-3 animate-pulse rounded-full bg-muted" /><div className="h-3 animate-pulse rounded-full bg-muted" /></div> : listings.length === 0 ? (
              <div className="mt-6 rounded-2xl bg-muted/40 p-4"><Rocket className="h-5 w-5 text-muted-foreground" /><p className="mt-3 text-sm font-medium">Start publishing</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Create your first product listing to begin building your store presence.</p><Button asChild size="sm" className="mt-4 rounded-full"><Link to="/upload">Create listing</Link></Button></div>
            ) : <>
              <div className="mt-6 flex items-end justify-between gap-3"><div><p className="text-3xl font-semibold tabular-nums">{published.length}</p><p className="text-xs text-muted-foreground">Published products</p></div><p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{published.length ? Math.round((liveReady / published.length) * 100) : 0}% ready</p></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${published.length ? (liveReady / published.length) * 100 : 0}%` }} /></div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{liveReady} of {published.length} live listings meet every readiness check.</p>
              <div className="mt-6 space-y-4">{[{ label: "Published", value: published.length, color: "bg-emerald-500" }, { label: "In review", value: pending.length, color: "bg-blue-500" }, { label: "Drafts", value: drafts.length, color: "bg-slate-400" }, { label: "Rejected", value: rejected.length, color: "bg-rose-500" }].map((item) => <div key={item.label} className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2 text-muted-foreground"><span className={`h-2 w-2 rounded-full ${item.color}`} />{item.label}</span><span className="font-semibold tabular-nums">{item.value}</span></div>)}</div>
              <Button asChild variant="outline" className="mt-6 w-full rounded-full"><Link to="/console/quality">Review listing quality <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            </>}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.85fr)]">
          <div className="dashboard-panel min-w-0">
            <div className="flex items-center justify-between gap-3"><div><p className="dashboard-eyebrow">YOUR CATALOGUE</p><h3 className="mt-1 text-lg font-semibold tracking-tight">Recent products</h3></div><Link to="/console/products" className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5">Manage all <ArrowRight className="h-4 w-4" /></Link></div>
            {listingsQuery.isLoading ? <div className="mt-5 space-y-4">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-14 animate-pulse rounded-xl bg-muted" />)}</div> : listings.length === 0 ? (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/40 p-4"><div><p className="text-sm font-medium">No products yet</p><p className="mt-1 text-xs text-muted-foreground">Publish an app, website, AI agent or browser extension.</p></div><Button asChild size="sm" className="rounded-full"><Link to="/upload">Create product</Link></Button></div>
            ) : <ul className="mt-4">{listings.slice(0, 5).map((listing) => <li key={listing.id} className="border-t border-border/70 first:border-t-0"><Link to="/console/products/$id" params={{ id: listing.id }} className="flex min-w-0 items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-muted/50"><AppIcon path={listing.icon_url} name={listing.name} className="h-11 w-11 rounded-xl" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{listing.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{listing.downloads} {metricLabel(listing.kind)} · {listing.rating_count} ratings</p></div><StatusPill status={listing.status} /><ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" /></Link></li>)}</ul>}
          </div>

          <div className="space-y-4">
            <div className="dashboard-panel">
              <div className="flex items-center justify-between gap-3"><div><p className="dashboard-eyebrow">NEXT STEPS</p><h3 className="mt-1 text-lg font-semibold tracking-tight">Needs your attention</h3></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${tasks.length ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}`}>{tasks.length} {tasks.length === 1 ? "item" : "items"}</span></div>
              {listingsQuery.isLoading ? <div className="mt-5 h-16 animate-pulse rounded-xl bg-muted" /> : tasks.length === 0 ? <div className="mt-5 flex items-start gap-3 rounded-2xl bg-emerald-50/70 p-4 dark:bg-emerald-950/30"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /><div><p className="text-sm font-medium">You are all caught up</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Nothing is blocked. Keep your listings complete and up to date.</p></div></div> : (
                <ul className="mt-3 space-y-1">{tasks.slice(0, 5).map((task) => <li key={task.key}><Link to="/console/products/$id" params={{ id: task.to }} className="flex items-start gap-3 rounded-xl px-2 py-3 text-sm transition-colors hover:bg-muted/50"><AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${task.tone === "warn" ? "text-rose-600" : "text-amber-600"}`} /><span className="min-w-0 flex-1 leading-5">{task.text}</span><ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /></Link></li>)}</ul>
              )}
            </div>

            <div className="dashboard-panel">
              <p className="dashboard-eyebrow">TRUST & QUALITY</p><div className="mt-1 flex items-center justify-between gap-3"><h3 className="text-lg font-semibold tracking-tight">Developer reputation</h3><Badge variant="secondary" className="rounded-full">{reputationTier(reputation)}</Badge></div>
              <div className="mt-5 flex items-baseline gap-1"><span className="text-3xl font-semibold tabular-nums">{reputation}</span><span className="text-sm text-muted-foreground">/100</span></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, reputation))}%` }} /></div><p className="mt-2 text-xs text-muted-foreground">Based on quality, ratings and product updates.</p>
            </div>

            <div className="dashboard-panel">
              <div className="flex items-center justify-between gap-2"><div><p className="dashboard-eyebrow">OPTIONAL PLAN</p><h3 className="mt-1 text-lg font-semibold tracking-tight">Developer Mode</h3></div><Badge variant={subscribed ? "default" : "outline"} className="rounded-full">{subscribed ? "Active" : "Optional"}</Badge></div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{subscribed ? `Your subscription is active. Renews ${subscriptionQuery.data?.current_period_end?.slice(0, 10) ?? "monthly"}.` : "Free for 3 months, then MK12,000/year for the full Developer Mode toolkit."}</p>
              <Button asChild size="sm" variant={subscribed ? "outline" : "default"} className="mt-4 w-full rounded-full"><Link to="/console/subscription">{subscribed ? "Manage subscription" : "Explore Developer Pro"}</Link></Button>
            </div>
          </div>
        </section>
      </div>
    </ConsoleShell>
  );
}
