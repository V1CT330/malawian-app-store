import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { SUBSCRIPTION_PRICE_MWK, formatMwk, type Listing } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Malawian App Store" },
      {
        name: "description",
        content: "Downloads, views, device and country breakdowns and monthly reports for your listings.",
      },
      { property: "og:title", content: "Analytics — Malawian App Store" },
      { property: "og:description", content: "Downloads, views, devices, countries and revenue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AnalyticsPage,
});

type Event = { created_at: string; device: string | null; country: string | null; listing_id: string };

function tally(rows: Event[], key: "device" | "country") {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = r[key] || "Unknown";
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function monthly(installs: Event[], views: Event[]) {
  const months: { name: string; installs: number; views: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toISOString().slice(0, 7);
    months.push({
      name: d.toLocaleString("en", { month: "short" }),
      installs: installs.filter((e) => e.created_at.startsWith(key)).length,
      views: views.filter((e) => e.created_at.startsWith(key)).length,
    });
  }
  return months;
}

function AnalyticsPage() {
  const { userId } = useSession();

  const listings = useQuery({
    queryKey: ["my-listings", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from("listings").select("*").eq("developer_id", userId!);
      if (error) throw error;
      return (data ?? []) as Listing[];
    },
  });

  const ids = (listings.data ?? []).map((l) => l.id);

  const events = useQuery({
    queryKey: ["analytics-events", userId, ids.length],
    enabled: ids.length > 0,
    queryFn: async () => {
      const [installs, views] = await Promise.all([
        supabase.from("install_events").select("created_at,device,country,listing_id").in("listing_id", ids),
        supabase.from("view_events").select("created_at,device,country,listing_id").in("listing_id", ids),
      ]);
      if (installs.error) throw installs.error;
      if (views.error) throw views.error;
      return {
        installs: (installs.data ?? []) as Event[],
        views: (views.data ?? []) as Event[],
      };
    },
  });

  const installs = events.data?.installs ?? [];
  const views = events.data?.views ?? [];
  const all = (listings.data ?? []);
  const paid = all.filter((l) => l.price_mwk > 0);
  const revenue = paid.reduce(
    (sum, l) => sum + l.price_mwk * installs.filter((e) => e.listing_id === l.id).length,
    0,
  );
  const activeUsers = new Set(views.map((v) => `${v.device}-${v.country}`)).size;
  const reviews = all.reduce((s, l) => s + l.rating_count, 0);
  const avg = reviews ? all.reduce((s, l) => s + l.rating_avg * l.rating_count, 0) / reviews : 0;

  const stats = [
    { label: "downloads", value: installs.length },
    { label: "views", value: views.length },
    { label: "active users", value: activeUsers },
    { label: "avg rating", value: avg ? avg.toFixed(1) : "—" },
  ];

  return (
    <AppShell>
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
        <BarChart3 className="h-5 w-5" /> Analytics
      </h1>
      <p className="text-sm text-muted-foreground">Across all of your listings.</p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="surface-card p-3 text-center">
            <p className="font-display text-xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="surface-card mt-4 p-4">
        <h2 className="font-display text-base font-semibold">Earnings estimate</h2>
        <p className="mt-1 text-2xl font-bold">{formatMwk(revenue)}</p>
        <p className="text-xs text-muted-foreground">
          Paid installs across {paid.length} paid listing{paid.length === 1 ? "" : "s"}. Publishing plan costs{" "}
          {formatMwk(SUBSCRIPTION_PRICE_MWK)}/month.
        </p>
      </div>

      {events.isLoading ? (
        <Skeleton className="mt-4 h-56 w-full rounded-2xl" />
      ) : (
        <>
          <section className="surface-card mt-4 p-4">
            <h2 className="mb-3 font-display text-base font-semibold">Last 6 months</h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthly(installs, views)}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="views" stroke="var(--google-blue)" strokeWidth={2} />
                  <Line type="monotone" dataKey="installs" stroke="var(--google-green)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {(["device", "country"] as const).map((key) => (
              <section key={key} className="surface-card p-4">
                <h2 className="mb-3 font-display text-base font-semibold capitalize">{key} breakdown</h2>
                {installs.length + views.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No traffic recorded yet.</p>
                ) : (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={tally([...installs, ...views], key).slice(0, 6)}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="name" fontSize={12} />
                        <YAxis fontSize={12} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="value" fill="var(--google-yellow)" radius={6} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
