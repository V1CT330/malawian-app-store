import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Download,
  Eye,
  Globe2,
  Monitor,
  Package,
  RefreshCw,
  Smartphone,
  Star,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ConsoleShell } from "@/components/console/ConsoleShell";
import { DemoPreview } from "@/components/DemoPreview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { kindLabel, type PortalListing } from "@/lib/portal";
import { useRequireDeveloper } from "@/hooks/useRequireDeveloper";

export const Route = createFileRoute("/_authenticated/console/analytics")({
  head: () => ({
    meta: [
      { title: "Advanced Analytics, Malawian App Store" },
      {
        name: "description",
        content: "Performance trends, conversion, audience breakdowns and per-product analytics.",
      },
      { property: "og:title", content: "Advanced Analytics, Malawian App Store" },
      { property: "og:description", content: "Performance trends and product intelligence." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AnalyticsPage,
});

type Event = {
  created_at: string;
  device: string | null;
  country: string | null;
  listing_id: string;
};

type RangeKey = "7d" | "30d" | "90d" | "custom";

const DAY = 24 * 60 * 60 * 1000;
const CHART_COLORS = [
  "var(--google-green)",
  "var(--google-blue)",
  "var(--google-yellow)",
  "var(--google-red)",
  "var(--primary)",
];

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function rangeFor(key: RangeKey, customStart: string, customEnd: string) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  let start = new Date(end);
  if (key === "7d") start = new Date(end.getTime() - 6 * DAY);
  else if (key === "30d") start = new Date(end.getTime() - 29 * DAY);
  else if (key === "90d") start = new Date(end.getTime() - 89 * DAY);
  else {
    start = customStart ? new Date(`${customStart}T00:00:00`) : new Date(end.getTime() - 29 * DAY);
    if (customEnd) {
      const selectedEnd = new Date(`${customEnd}T23:59:59.999`);
      if (!Number.isNaN(selectedEnd.getTime())) end.setTime(selectedEnd.getTime());
    }
  }
  if (Number.isNaN(start.getTime())) start = new Date(end.getTime() - 29 * DAY);
  if (start > end) start.setTime(end.getTime() - 29 * DAY);
  const duration = Math.min(365, Math.max(1, Math.floor((end.getTime() - start.getTime()) / DAY) + 1));
  start.setTime(end.getTime() - (duration - 1) * DAY);
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - duration * DAY + 1);
  return { start, end, previousStart, previousEnd, duration };
}

function within(event: Event, start: Date, end: Date) {
  const time = new Date(event.created_at).getTime();
  return Number.isFinite(time) && time >= start.getTime() && time <= end.getTime();
}

function tally(rows: Event[], key: "device" | "country") {
  const map = new Map<string, number>();
  for (const row of rows) {
    const name = row[key]?.trim() || "Unknown";
    map.set(name, (map.get(name) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

async function fetchEvents(
  table: "install_events" | "view_events",
  listingIds: string[],
  startIso: string,
  endIso: string,
): Promise<Event[]> {
  const pageSize = 1000;
  const rows: Event[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const result = table === "install_events"
      ? await supabase.from("install_events")
          .select("created_at,device,country,listing_id")
          .in("listing_id", listingIds)
          .gte("created_at", startIso)
          .lte("created_at", endIso)
          .order("created_at", { ascending: true })
          .range(offset, offset + pageSize - 1)
      : await supabase.from("view_events")
          .select("created_at,device,country,listing_id")
          .in("listing_id", listingIds)
          .gte("created_at", startIso)
          .lte("created_at", endIso)
          .order("created_at", { ascending: true })
          .range(offset, offset + pageSize - 1);
    if (result.error) throw result.error;
    const page = (result.data ?? []) as Event[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function makeTrend(installs: Event[], views: Event[], start: Date, end: Date, duration: number) {
  const useDaily = duration <= 90;
  const buckets: { key: string; label: string; installs: number; views: number }[] = [];
  const count = useDaily ? duration : Math.min(12, Math.ceil(duration / 30));
  const formatter = new Intl.DateTimeFormat("en", useDaily
    ? { month: "short", day: "numeric" }
    : { month: "short", year: "2-digit" });

  for (let i = 0; i < count; i += 1) {
    const from = new Date(start);
    const to = new Date(start);
    if (useDaily) {
      from.setDate(start.getDate() + i);
      to.setTime(from.getTime() + DAY - 1);
    } else {
      from.setMonth(start.getMonth() + i);
      to.setMonth(from.getMonth() + 1, 0);
      to.setHours(23, 59, 59, 999);
    }
    if (from > end) break;
    const bucketEnd = to > end ? end : to;
    buckets.push({
      key: from.toISOString(),
      label: formatter.format(from),
      installs: installs.filter((event) => within(event, from, bucketEnd)).length,
      views: views.filter((event) => within(event, from, bucketEnd)).length,
    });
  }
  return buckets;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en").format(value);
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? null : 100;
  return ((current - previous) / previous) * 100;
}

function Change({ current, previous }: { current: number; previous: number }) {
  const change = percentChange(current, previous);
  if (change === null) {
    return <span className="text-xs text-muted-foreground">No previous-period baseline</span>;
  }
  const positive = change >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${positive ? "text-brand-green" : "text-destructive"}`}>
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(change).toFixed(1)}% vs previous period
    </span>
  );
}

function Metric({
  label,
  value,
  hint,
  icon: Icon,
  current,
  previous,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Eye;
  current?: number;
  previous?: number;
}) {
  return (
    <section className="surface-card min-w-0 border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
      <p className="mt-3 font-display text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      {current !== undefined && previous !== undefined && (
        <div className="mt-3"><Change current={current} previous={previous} /></div>
      )}
    </section>
  );
}

function AnalyticsPage() {
  useRequireDeveloper();
  const { userId } = useSession();
  const [range, setRange] = useState<RangeKey>("30d");
  const [customStart, setCustomStart] = useState(isoDate(new Date(Date.now() - 29 * DAY)));
  const [customEnd, setCustomEnd] = useState(isoDate(new Date()));
  const [selectedProduct, setSelectedProduct] = useState("all");

  const bounds = useMemo(
    () => rangeFor(range, customStart, customEnd),
    [range, customStart, customEnd],
  );

  const subscription = useQuery({
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
  const subscriptionStatus = subscription.data?.status;
  const periodEnd = subscription.data?.current_period_end
    ? Date.parse(subscription.data.current_period_end)
    : null;
  const hasPro =
    (subscriptionStatus === "active" && (periodEnd === null || periodEnd > Date.now())) ||
    (subscriptionStatus === "cancelled" && periodEnd !== null && periodEnd > Date.now());

  const listings = useQuery({
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

  const all = listings.data ?? [];
  const ids = all.map((listing) => listing.id);
  const startIso = bounds.previousStart.toISOString();
  const endIso = bounds.end.toISOString();

  const events = useQuery({
    queryKey: ["advanced-analytics-events", userId, ids.join(","), startIso, endIso],
    enabled: Boolean(userId && hasPro) && ids.length > 0,
    queryFn: async () => {
      const [installs, views] = await Promise.all([
        fetchEvents("install_events", ids, startIso, endIso),
        fetchEvents("view_events", ids, startIso, endIso),
      ]);
      return { installs, views };
    },
    staleTime: 60_000,
  });

  const installRows = events.data?.installs ?? [];
  const viewRows = events.data?.views ?? [];
  const selectedIds = selectedProduct === "all" ? new Set(ids) : new Set([selectedProduct]);
  const currentInstalls = installRows.filter((row) => selectedIds.has(row.listing_id) && within(row, bounds.start, bounds.end));
  const currentViews = viewRows.filter((row) => selectedIds.has(row.listing_id) && within(row, bounds.start, bounds.end));
  const previousInstalls = installRows.filter((row) => selectedIds.has(row.listing_id) && within(row, bounds.previousStart, bounds.previousEnd));
  const previousViews = viewRows.filter((row) => selectedIds.has(row.listing_id) && within(row, bounds.previousStart, bounds.previousEnd));

  const appIds = new Set(all.filter((listing) => listing.kind !== "website").map((listing) => listing.id));
  const websiteIds = new Set(all.filter((listing) => listing.kind === "website").map((listing) => listing.id));
  const appInstalls = currentInstalls.filter((event) => appIds.has(event.listing_id));
  const websiteVisits = currentInstalls.filter((event) => websiteIds.has(event.listing_id));
  const appViews = currentViews.filter((event) => appIds.has(event.listing_id));
  const conversion = appViews.length ? (appInstalls.length / appViews.length) * 100 : 0;
  const previousAppInstalls = previousInstalls.filter((event) => appIds.has(event.listing_id));
  const previousAppViews = previousViews.filter((event) => appIds.has(event.listing_id));
  const previousConversion = previousAppViews.length ? (previousAppInstalls.length / previousAppViews.length) * 100 : 0;

  const weightedRatings = all.filter((listing) => selectedIds.has(listing.id)).reduce(
    (sum, listing) => sum + listing.rating_avg * listing.rating_count,
    0,
  );
  const ratingCount = all.filter((listing) => selectedIds.has(listing.id)).reduce(
    (sum, listing) => sum + listing.rating_count,
    0,
  );
  const averageRating = ratingCount ? weightedRatings / ratingCount : 0;

  const trend = useMemo(
    () => makeTrend(currentInstalls, currentViews, bounds.start, bounds.end, bounds.duration),
    [installRows, viewRows, selectedProduct, range, customStart, customEnd],
  );
  const deviceData = tally([...currentInstalls, ...currentViews], "device").slice(0, 6);
  const countryData = tally([...currentInstalls, ...currentViews], "country").slice(0, 6);
  const productRows = all
    .filter((listing) => selectedProduct === "all" || listing.id === selectedProduct)
    .map((listing) => {
      const views = currentViews.filter((event) => event.listing_id === listing.id).length;
      const installs = currentInstalls.filter((event) => event.listing_id === listing.id).length;
      return { listing, views, installs, conversion: views ? (installs / views) * 100 : 0 };
    })
    .sort((a, b) => b.installs - a.installs);

  const hasEvents = currentInstalls.length + currentViews.length > 0;
  const periodLabel = `${isoDate(bounds.start)} – ${isoDate(bounds.end)}`;
  const dataStatus = events.isError
    ? "Analytics data could not be loaded. Retry to check the event tables and permissions."
    : events.isLoading
      ? "Loading event data…"
      : hasEvents
        ? "Event tracking is recording activity for this period."
        : "No install or view events were recorded for this period. This may mean low traffic or missing instrumentation.";

  function exportCsv() {
    const rows = [
      ["Product", "Type", "Status", "Views in period", "Installs / visits in period", "Conversion rate", "Lifetime installs / visits", "Average rating", "Rating count"],
      ...productRows.map(({ listing, views, installs, conversion: rate }) => [
        listing.name,
        kindLabel(listing.kind),
        listing.status,
        String(views),
        String(installs),
        `${rate.toFixed(2)}%`,
        String(listing.downloads),
        String(listing.rating_avg ?? 0),
        String(listing.rating_count ?? 0),
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `mas-analytics-${isoDate(bounds.start)}-to-${isoDate(bounds.end)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (subscription.isLoading) {
    return (
      <ConsoleShell title="Analytics">
        <Skeleton className="h-40 w-full" />
      </ConsoleShell>
    );
  }

  if (subscription.isError) {
    return (
      <ConsoleShell title="Analytics">
        <section className="surface-card border border-destructive/40 p-5">
          <h1 className="font-display text-xl font-semibold">Membership status unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">We couldn't confirm your Developer Pro status. Retry before opening advanced analytics.</p>
          <Button className="mt-4" variant="outline" onClick={() => void subscription.refetch()}>Retry</Button>
        </section>
      </ConsoleShell>
    );
  }

  if (!hasPro) {
    return (
      <ConsoleShell title="Advanced Analytics">
        <section className="surface-card max-w-2xl border border-border p-6">
          <Badge variant="outline">Developer Pro feature</Badge>
          <h1 className="mt-3 font-display text-2xl font-bold">Unlock advanced analytics</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Track product views, installs, conversion, audience trends and export reports with Developer Pro.
          </p>
          <p className="mt-4 font-display text-xl font-semibold">MK5,000 per month</p>
          <Button asChild className="mt-4">
            <Link to="/console/subscription">View Developer Pro</Link>
          </Button>
        </section>
      </ConsoleShell>
    );
  }

  return (
    <ConsoleShell title="Analytics">
      {!listings.isLoading && all.length === 0 && <DemoPreview title="Analytics dashboard · sample view" description="Illustrative performance data only. Real charts will use events recorded for your products." items={[{ title: "Product page views", detail: "Daily visits across published listings.", metric: "3,840 · sample", status: "30 days" }, { title: "Installs", detail: "Install events attributed to product listings.", metric: "1,275 · sample", status: "30 days" }, { title: "Top device", detail: "Example audience breakdown.", metric: "Android · 78%", status: "Sample" }, { title: "Top location", detail: "Example country breakdown.", metric: "Malawi · 92%", status: "Sample" }]} />}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h1 className="font-display text-2xl font-bold">Insights</h1>
            <Badge variant="outline">Advanced</Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Measure product performance, understand your audience and spot changes worth investigating.
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={productRows.length === 0}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <section className="surface-card mt-5 border border-border p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[190px] flex-1">
            <label htmlFor="analytics-product" className="mb-1.5 block text-xs font-medium text-muted-foreground">Product</label>
            <select
              id="analytics-product"
              value={selectedProduct}
              onChange={(event) => setSelectedProduct(event.target.value)}
              className="h-10 w-full border border-input bg-background px-3 text-sm"
            >
              <option value="all">All products</option>
              {all.map((listing) => <option key={listing.id} value={listing.id}>{listing.name}</option>)}
            </select>
          </div>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Reporting period</span>
            <div className="flex flex-wrap border border-border">
              {(["7d", "30d", "90d", "custom"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRange(key)}
                  aria-pressed={range === key}
                  className={`h-10 border-r border-border px-3 text-sm last:border-r-0 ${range === key ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                >
                  {key === "custom" ? "Custom" : key.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          {range === "custom" && (
            <>
              <div>
                <label htmlFor="analytics-start" className="mb-1.5 block text-xs font-medium text-muted-foreground">From</label>
                <input id="analytics-start" type="date" value={customStart} max={customEnd || isoDate(new Date())} onChange={(event) => setCustomStart(event.target.value)} className="h-10 border border-input bg-background px-3 text-sm" />
              </div>
              <div>
                <label htmlFor="analytics-end" className="mb-1.5 block text-xs font-medium text-muted-foreground">To</label>
                <input id="analytics-end" type="date" value={customEnd} min={customStart} max={isoDate(new Date())} onChange={(event) => setCustomEnd(event.target.value)} className="h-10 border border-input bg-background px-3 text-sm" />
              </div>
            </>
          )}
        </div>
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          {periodLabel} · compared with the immediately preceding {bounds.duration}-day period
        </p>
      </section>

      {listings.isError || events.isError ? (
        <section className="mt-4 border border-destructive/40 bg-destructive/5 p-4">
          <p className="font-medium">Analytics could not be loaded</p>
          <p className="mt-1 text-sm text-muted-foreground">{listings.error instanceof Error ? listings.error.message : events.error instanceof Error ? events.error.message : "Check your connection and permissions."}</p>
          <Button className="mt-3" variant="outline" onClick={() => { void listings.refetch(); void events.refetch(); }}>
            <RefreshCw className="mr-2 h-4 w-4" /> Retry
          </Button>
        </section>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="App installs" value={formatNumber(appInstalls.length)} hint="Tracked events in selected period" icon={Download} current={appInstalls.length} previous={previousAppInstalls.length} />
            <Metric label="Product views" value={formatNumber(appViews.length)} hint="Tracked app listing views" icon={Eye} current={appViews.length} previous={previousAppViews.length} />
            <Metric label="View-to-install rate" value={appViews.length ? `${conversion.toFixed(1)}%` : "—"} hint="Installs divided by tracked app views" icon={TrendingUp} current={conversion} previous={previousConversion} />
            <Metric label="Average rating" value={ratingCount ? averageRating.toFixed(2) : "—"} hint={`${formatNumber(ratingCount)} ratings across selected products`} icon={Star} />
          </div>

          <section className="surface-card mt-4 border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-semibold">Performance over time</h2>
                <p className="mt-1 text-xs text-muted-foreground">Daily activity for periods up to 90 days; longer periods are grouped by month.</p>
              </div>
              <Badge variant="outline">{periodLabel}</Badge>
            </div>
            {events.isLoading ? <Skeleton className="mt-4 h-72 w-full" /> : (
              <div className="mt-4 h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="label" fontSize={11} minTickGap={20} />
                    <YAxis fontSize={11} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="views" name="Product views" stroke="var(--google-blue)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="installs" name="Installs / visits" stroke="var(--google-green)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {!events.isLoading && !hasEvents && <p className="text-sm text-muted-foreground">No events to plot for this period yet.</p>}
          </section>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <section className="surface-card min-w-0 border border-border p-4">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-display text-base font-semibold">Device distribution</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Combined tracked views and install events, not unique people.</p>
              {deviceData.length ? (
                <div className="mt-3 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={deviceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={82} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                        {deviceData.map((entry, index) => <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="py-12 text-center text-sm text-muted-foreground">Device data will appear when events are recorded.</p>}
            </section>
            <section className="surface-card min-w-0 border border-border p-4">
              <div className="flex items-center gap-2">
                <Globe2 className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-display text-base font-semibold">Country distribution</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Based on country values stored with events; accuracy depends on the tracker.</p>
              {countryData.length ? (
                <div className="mt-3 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={countryData} layout="vertical" margin={{ left: 8, right: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis type="number" fontSize={11} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" width={76} fontSize={11} />
                      <Tooltip />
                      <Bar dataKey="value" name="Events" fill="var(--google-yellow)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="py-12 text-center text-sm text-muted-foreground">Country data will appear when events include country values.</p>}
            </section>
          </div>

          <section className="surface-card mt-4 border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-semibold">Product performance</h2>
                <p className="mt-1 text-xs text-muted-foreground">Ranked by tracked installs or visits in this period. Lifetime totals and ratings come from product records.</p>
              </div>
              <Badge variant="outline">{productRows.length} products</Badge>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-3 py-3 font-medium">Product</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 text-right font-medium">Views</th>
                    <th className="px-3 py-3 text-right font-medium">Installs / visits</th>
                    <th className="px-3 py-3 text-right font-medium">Conversion</th>
                    <th className="px-3 py-3 text-right font-medium">Lifetime total</th>
                    <th className="px-3 py-3 text-right font-medium">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {productRows.map(({ listing, views, installs, conversion: rate }) => (
                    <tr key={listing.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-3">
                        <Link to="/console/products/$id" params={{ id: listing.id }} className="font-medium hover:underline">{listing.name}</Link>
                        <p className="mt-0.5 text-xs text-muted-foreground">{kindLabel(listing.kind)} · {listing.category}</p>
                      </td>
                      <td className="px-3 py-3"><Badge variant={listing.status === "published" ? "default" : "secondary"} className="capitalize">{listing.status}</Badge></td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatNumber(views)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatNumber(installs)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{views ? `${rate.toFixed(1)}%` : "—"}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatNumber(listing.downloads)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{listing.rating_count ? `${Number(listing.rating_avg).toFixed(1)} ★` : "—"}</td>
                    </tr>
                  ))}
                  {productRows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Publish products to see performance comparisons.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="surface-card border border-border p-4">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-display text-base font-semibold">Audience signals</h2>
              </div>
              <div className="mt-3 divide-y divide-border">
                <div className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="text-muted-foreground">Tracked views</span><strong className="tabular-nums">{formatNumber(currentViews.length)}</strong>
                </div>
                <div className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="text-muted-foreground">Tracked install / visit events</span><strong className="tabular-nums">{formatNumber(currentInstalls.length)}</strong>
                </div>
                <div className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="text-muted-foreground">Devices observed</span><strong className="tabular-nums">{tally([...currentInstalls, ...currentViews], "device").length}</strong>
                </div>
                <div className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="text-muted-foreground">Countries represented</span><strong className="tabular-nums">{tally([...currentInstalls, ...currentViews], "country").filter((row) => row.name !== "Unknown").length}</strong>
                </div>
              </div>
            </div>
            <div className="surface-card border border-border p-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-display text-base font-semibold">Tracking health</h2>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{dataStatus}</p>
              <div className="mt-4 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
                This dashboard reports only events the current app records. Unique users, retention, revenue, search attribution, version adoption and crash rates are not available from the current event feeds and are intentionally not estimated.
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <Package className="h-3.5 w-3.5" />
                {formatNumber(all.length)} total products · {formatNumber(all.filter((listing) => listing.status === "published").length)} published
              </div>
            </div>
          </section>
        </>
      )}
    </ConsoleShell>
  );
}
