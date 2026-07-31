import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Download, TrendingUp } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_COMMISSION, downloadCsv, methodLabel } from "@/lib/payments";
import { formatAmount } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/business")({
  head: () => ({
    meta: [
      { title: "Business dashboard — Malawian App Store" },
      {
        name: "description",
        content:
          "Revenue, profit, conversion, refunds, geographic sales and exportable tax statements for Malawian app developers.",
      },
      { property: "og:title", content: "Business dashboard — Malawian App Store" },
      { property: "og:description", content: "Revenue, refunds and tax reports for your listings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BusinessPage,
});

type Order = {
  id: string;
  listing_id: string;
  buyer_id: string | null;
  kind: string;
  amount_mwk: number;
  commission_mwk: number;
  net_mwk: number;
  method: string;
  country: string | null;
  status: string;
  created_at: string;
};

function BusinessPage() {
  const { userId } = useSession();

  const ordersQuery = useQuery({
    queryKey: ["orders", "seller", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("seller_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Order[];
    },
  });

  const viewsQuery = useQuery({
    queryKey: ["views", "seller", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data: listings } = await supabase.from("listings").select("id").eq("developer_id", userId!);
      const ids = (listings ?? []).map((l) => l.id);
      if (ids.length === 0) return 0;
      const { count } = await supabase
        .from("view_events")
        .select("id", { count: "exact", head: true })
        .in("listing_id", ids);
      return count ?? 0;
    },
  });

  const orders = ordersQuery.data ?? [];
  const paid = orders.filter((o) => o.status === "paid");
  const refunded = orders.filter((o) => o.status === "refunded");
  const revenue = paid.reduce((sum, o) => sum + Number(o.amount_mwk), 0);
  const profit = paid.reduce((sum, o) => sum + Number(o.net_mwk), 0);
  const commission = revenue - profit;
  const views = viewsQuery.data ?? 0;
  const conversion = views > 0 ? (paid.length / views) * 100 : 0;
  const buyers = new Set(paid.map((o) => o.buyer_id).filter(Boolean));
  const repeat = paid.length - buyers.size;
  const retention = buyers.size > 0 ? (repeat / buyers.size) * 100 : 0;

  const byMonth = new Map<string, number>();
  paid.forEach((o) => {
    const key = new Date(o.created_at).toLocaleDateString("en", { month: "short", year: "2-digit" });
    byMonth.set(key, (byMonth.get(key) ?? 0) + Number(o.amount_mwk));
  });
  const months = [...byMonth.entries()].reverse();
  const maxMonth = Math.max(1, ...months.map(([, v]) => v));

  const byCountry = new Map<string, number>();
  paid.forEach((o) => byCountry.set(o.country ?? "MW", (byCountry.get(o.country ?? "MW") ?? 0) + Number(o.amount_mwk)));

  const byMethod = new Map<string, number>();
  paid.forEach((o) => byMethod.set(o.method, (byMethod.get(o.method) ?? 0) + Number(o.amount_mwk)));

  return (
    <AppShell>
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
        <TrendingUp className="h-6 w-6 text-primary" /> Business
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Platform commission {DEFAULT_COMMISSION.standard}% standard · {DEFAULT_COMMISSION.premium}% for premium
        developers.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Revenue", value: formatAmount(revenue) },
          { label: "Net profit", value: formatAmount(profit) },
          { label: "Commission", value: formatAmount(commission) },
          { label: "Orders", value: String(paid.length) },
          { label: "Conversion", value: `${conversion.toFixed(1)}%` },
          { label: "Repeat buyers", value: `${retention.toFixed(0)}%` },
          { label: "Refunds", value: String(refunded.length) },
          { label: "Store views", value: String(views) },
        ].map((s) => (
          <div key={s.label} className="surface-card p-3">
            <p className="font-display text-lg font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <section className="surface-card mt-4 p-4">
        <h2 className="mb-3 font-display text-base font-semibold">Sales trend</h2>
        {months.length ? (
          <ul className="space-y-2">
            {months.map(([month, value]) => (
              <li key={month} className="flex items-center gap-3 text-xs">
                <span className="w-14 shrink-0 text-muted-foreground">{month}</span>
                <span className="h-2 flex-1 rounded-full bg-secondary">
                  <span className="block h-2 rounded-full bg-primary" style={{ width: `${(value / maxMonth) * 100}%` }} />
                </span>
                <span className="w-20 shrink-0 text-right">{formatAmount(value)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No sales recorded yet.</p>
        )}
      </section>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <section className="surface-card p-4">
          <h2 className="mb-2 font-display text-base font-semibold">Geographic sales</h2>
          {byCountry.size ? (
            <ul className="space-y-1 text-sm">
              {[...byCountry.entries()].map(([c, v]) => (
                <li key={c} className="flex justify-between">
                  <span>{c}</span>
                  <span className="text-muted-foreground">{formatAmount(v)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          )}
        </section>
        <section className="surface-card p-4">
          <h2 className="mb-2 font-display text-base font-semibold">Payment methods</h2>
          {byMethod.size ? (
            <ul className="space-y-1 text-sm">
              {[...byMethod.entries()].map(([m, v]) => (
                <li key={m} className="flex justify-between">
                  <span>{methodLabel(m)}</span>
                  <span className="text-muted-foreground">{formatAmount(v)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          )}
        </section>
      </div>

      <section className="surface-card mt-4 space-y-3 p-4">
        <h2 className="font-display text-base font-semibold">Financial statements</h2>
        <p className="text-sm text-muted-foreground">
          Export your ledger for accounting or Malawi Revenue Authority filing.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={orders.length === 0}
            onClick={() =>
              downloadCsv(
                "malawian-app-store-sales.csv",
                orders.map((o) => ({
                  date: new Date(o.created_at).toISOString(),
                  kind: o.kind,
                  method: methodLabel(o.method),
                  gross_mwk: o.amount_mwk,
                  commission_mwk: o.commission_mwk,
                  net_mwk: o.net_mwk,
                  status: o.status,
                  country: o.country ?? "MW",
                })),
              )
            }
          >
            <Download className="mr-2 h-4 w-4" /> Sales CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={paid.length === 0}
            onClick={() =>
              downloadCsv("malawian-app-store-tax-summary.csv", [
                {
                  period: new Date().getFullYear(),
                  gross_revenue_mwk: revenue,
                  platform_commission_mwk: commission,
                  net_earnings_mwk: profit,
                  orders: paid.length,
                  refunds: refunded.length,
                },
              ])
            }
          >
            <Download className="mr-2 h-4 w-4" /> Tax summary
          </Button>
        </div>
      </section>
    </AppShell>
  );
}
