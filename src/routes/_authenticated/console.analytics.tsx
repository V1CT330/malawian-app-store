import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
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

import { ConsoleShell } from "@/components/console/ConsoleShell";
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
      { title: "Stats & Products, Malawian App Store" },
      {
        name: "description",
        content:
          "Downloads, views, device and country breakdowns plus a simple list of the products you publish.",
      },
      { property: "og:title", content: "Stats & Products, Malawian App Store" },
      { property: "og:description", content: "Performance and products in one place." },
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

function tally(rows: Event[], key: "device" | "country") {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = r[key] || "Unknown";
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function monthly(installs: Event[], visits: Event[], views: Event[]) {
  const months: { name: string; installs: number; visits: number; views: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({
      name: d.toLocaleString("en", { month: "short" }),
      installs: installs.filter((e) => e.created_at.startsWith(key)).length,
      visits: visits.filter((e) => e.created_at.startsWith(key)).length,
      views: views.filter((e) => e.created_at.startsWith(key)).length,
    });
  }
  return months;
}

function AnalyticsPage() {
  useRequireDeveloper();
  const { userId } = useSession();

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
  const ids = all.map((l) => l.id);

  const events = useQuery({
    queryKey: ["analytics-events", userId, ids.length],
    enabled: ids.length > 0,
    queryFn: async () => {
      const [installs, views] = await Promise.all([
        supabase
          .from("install_events")
          .select("created_at,device,country,listing_id")
          .in("listing_id", ids),
        supabase
          .from("view_events")
          .select("created_at,device,country,listing_id")
          .in("listing_id", ids),
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
  const appIds = new Set(all.filter((l) => l.kind !== "website").map((l) => l.id));
  const websiteIds = new Set(all.filter((l) => l.kind === "website").map((l) => l.id));
  const appInstalls = installs.filter((event) => appIds.has(event.listing_id));
  const websiteVisits = installs.filter((event) => websiteIds.has(event.listing_id));
  const reviews = all.reduce((s, l) => s + l.rating_count, 0);
  const avg = reviews ? all.reduce((s, l) => s + l.rating_avg * l.rating_count, 0) / reviews : 0;

  const stats = [
    { label: "app installs", value: appInstalls.length },
    { label: "website visits", value: websiteVisits.length },
    { label: "store views", value: views.length },
    { label: "avg rating", value: avg ? avg.toFixed(1) : "N/A" },
  ];

  return (
    <ConsoleShell title="Analytics">
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
        <BarChart3 className="h-5 w-5" /> Growth
      </h1>
      <p className="text-sm text-muted-foreground">
        Performance and products across everything you publish.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="surface-card p-3 text-center">
            <p className="font-display text-xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <section className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">Products</h2>
          <Button asChild size="sm" className="rounded-full">
            <Link to="/upload">New product</Link>
          </Button>
        </div>
        {listings.isLoading ? (
          <Skeleton className="h-24 w-full rounded-2xl" />
        ) : all.length === 0 ? (
          <p className="surface-card p-6 text-center text-sm text-muted-foreground">
            Nothing published yet. Upload your first product to get started.
          </p>
        ) : (
          <ul className="space-y-2">
            {all.map((l) => (
              <li key={l.id} className="surface-card flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{l.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {kindLabel(l.kind)} · {l.downloads} {l.kind === "website" ? "visits" : "installs"} · {l.rating_avg || "N/A"} ★
                  </p>
                </div>
                <Badge
                  variant={l.status === "published" ? "default" : "secondary"}
                  className="ml-auto capitalize"
                >
                  {l.status}
                </Badge>
                <Button asChild size="sm" variant="outline">
                  <Link to="/console/products/$id" params={{ id: l.id }}>
                    Manage
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {events.isLoading ? (
        <Skeleton className="mt-4 h-56 w-full rounded-2xl" />
      ) : (
        <>
          <section className="surface-card mt-4 p-4">
            <h2 className="mb-1 font-display text-base font-semibold">Last 6 months</h2>
            <p className="mb-3 text-xs text-muted-foreground">App installs, website visits and store views.</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthly(appInstalls, websiteVisits, views)}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} allowDecimals={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="views"
                    stroke="var(--google-blue)"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="visits"
                    stroke="var(--google-yellow)"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="installs"
                    stroke="var(--google-green)"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {(["device", "country"] as const).map((key) => (
              <section key={key} className="surface-card p-4">
                <h2 className="mb-3 font-display text-base font-semibold capitalize">
                  {key} breakdown
                </h2>
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
    </ConsoleShell>
  );
}
