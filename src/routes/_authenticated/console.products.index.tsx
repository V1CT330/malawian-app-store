import { createFileRoute, Link } from "@tanstack/react-router";
import { LayoutList, PlusCircle, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { ConsoleShell } from "@/components/console/ConsoleShell";
import { EmptyState, RowSkeletons, StatusPill } from "@/components/console/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/hooks/useSession";
import { useRequireDeveloper } from "@/hooks/useRequireDeveloper";
import { metricLabel, readinessScore } from "@/lib/console";
import { useMyListings } from "@/lib/console.queries";
import { kindLabel } from "@/lib/portal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/console/products/")({
  head: () => ({
    meta: [
      { title: "All Products — Developer Console" },
      {
        name: "description",
        content:
          "Every app, website, AI agent and extension you publish, with review status, installs and ratings.",
      },
      { property: "og:title", content: "All Products — Developer Console" },
      { property: "og:description", content: "Manage all of your published products." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductsPage,
});

const FILTERS = [
  { key: "all", label: "All" },
  { key: "published", label: "Live" },
  { key: "pending", label: "In review" },
  { key: "draft", label: "Draft" },
  { key: "rejected", label: "Rejected" },
  { key: "archived", label: "Archived" },
] as const;

function ProductsPage() {
  useRequireDeveloper();
  const { userId } = useProfile();
  const listingsQuery = useMyListings(userId);
  const [filter, setFilter] = useState<string>("all");
  const [term, setTerm] = useState("");

  const listings = listingsQuery.data ?? [];
  const rows = useMemo(
    () =>
      listings.filter(
        (l) =>
          (filter === "all" || l.status === filter) &&
          l.name.toLowerCase().includes(term.trim().toLowerCase()),
      ),
    [listings, filter, term],
  );

  return (
    <ConsoleShell
      title="All products"
      description="Every product on your developer account."
      breadcrumbs={[{ label: "Console", to: "/console" }, { label: "All products" }]}
      actions={
        <Button asChild>
          <Link to="/upload">
            <PlusCircle className="mr-2 h-4 w-4" /> New product
          </Link>
        </Button>
      }
    >
      <div className="mb-4 flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search your products"
            className="pl-9"
            aria-label="Search your products"
          />
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {FILTERS.map((f) => {
            const count = f.key === "all" ? listings.length : listings.filter((l) => l.status === f.key).length;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === f.key
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {listingsQuery.isLoading ? (
        <RowSkeletons count={4} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={LayoutList}
          title={listings.length === 0 ? "Publish your first product" : "Nothing matches that filter"}
          description={
            listings.length === 0
              ? "Create a listing, complete the checklist and submit it to the store review team."
              : "Try another status or clear the search."
          }
          action={
            listings.length === 0 ? (
              <Button asChild>
                <Link to="/upload">Start a listing</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((l) => (
            <li key={l.id} className="surface-card p-4">
              <Link
                to="/console/products/$id"
                params={{ id: l.id }}
                className="flex items-center gap-3"
              >
                <img
                  src={l.icon_url ?? "/favicon.png"}
                  alt=""
                  className="h-12 w-12 rounded-2xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{l.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {kindLabel(l.kind)} · {l.downloads} {metricLabel(l.kind)} ·{" "}
                    {l.rating_count > 0 ? `${Number(l.rating_avg).toFixed(1)} stars` : "no ratings yet"}
                  </p>
                  {l.status === "draft" && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {readinessScore(l)}% ready to submit
                    </p>
                  )}
                </div>
                <StatusPill status={l.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ConsoleShell>
  );
}
