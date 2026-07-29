import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Sparkles } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { ListingCard } from "@/components/ListingCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, type Listing } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Malawian App Store — Apps & Websites Built in Malawi" },
      {
        name: "description",
        content:
          "Discover, install and review apps and websites made by Malawian developers. Publish your own app with a verified developer account.",
      },
      { property: "og:title", content: "Malawian App Store — Apps & Websites Built in Malawi" },
      {
        property: "og:description",
        content: "Discover, install and review apps and websites made by Malawian developers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StorePage,
});

function StorePage() {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"all" | "app" | "website">("all");
  const [category, setCategory] = useState<string>("All");

  const { data, isLoading } = useQuery({
    queryKey: ["listings", "published"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Listing[];
    },
  });

  const listings = (data ?? []).filter((l) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      l.name.toLowerCase().includes(q) ||
      (l.tagline ?? "").toLowerCase().includes(q) ||
      l.category.toLowerCase().includes(q);
    const matchesKind = kind === "all" || l.kind === kind;
    const matchesCategory = category === "All" || l.category === category;
    return matchesSearch && matchesKind && matchesCategory;
  });

  const featured = listings.slice(0, 3);

  return (
    <AppShell>
      <section className="surface-card mb-5 overflow-hidden p-5">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
          <Sparkles className="h-3.5 w-3.5" /> Made in Malawi
        </p>
        <h1 className="mt-3 font-display text-2xl font-bold leading-tight">
          Every Malawian <span className="text-gradient-google">app & website</span> in one store
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Install local apps, review them, and publish your own as a verified developer.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/upload">Publish your app</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/dashboard">Developer dashboard</Link>
          </Button>
        </div>
      </section>

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search apps and websites"
          className="pl-9"
          aria-label="Search apps and websites"
        />
      </div>

      <div className="mb-3 flex gap-2">
        {(["all", "app", "website"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={cn(
              "rounded-full border border-border px-3 py-1.5 text-xs font-medium capitalize",
              kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {k === "all" ? "Everything" : `${k}s`}
          </button>
        ))}
      </div>

      <div className="mb-5 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {["All", ...CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn(
              "shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-medium",
              category === c ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="surface-card p-8 text-center">
          <h2 className="font-display text-lg font-semibold">Nothing here yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Be the first developer to publish on the Malawian App Store.
          </p>
          <Button asChild className="mt-4">
            <Link to="/upload">Upload a listing</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {search === "" && category === "All" && kind === "all" && featured.length > 0 && (
            <section>
              <h2 className="mb-2 font-display text-base font-semibold">Fresh this week</h2>
              <div className="space-y-3">
                {featured.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>
            </section>
          )}
          <section>
            <h2 className="mb-2 font-display text-base font-semibold">
              {listings.length} listing{listings.length === 1 ? "" : "s"}
            </h2>
            <div className="space-y-3">
              {listings.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
