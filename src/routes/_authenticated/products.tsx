import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { PortalTabs } from "@/components/PortalTabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { kindLabel, logActivity, PRODUCT_STATUSES, type PortalListing } from "@/lib/portal";
import { slugify } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({
    meta: [
      { title: "Product Management — Malawian App Store" },
      {
        name: "description",
        content:
          "Publish, edit, archive, duplicate and delete your apps, websites, AI agents and browser extensions.",
      },
      { property: "og:title", content: "Product Management — Malawian App Store" },
      { property: "og:description", content: "Manage every product you publish in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const { userId } = useSession();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [term, setTerm] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["portal-products", userId],
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

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["portal-products", userId] });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("listings")
        .update({
          status,
          archived_at: status === "archived" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
      if (userId) await logActivity({ ownerId: userId, actorId: userId, action: `Set status to ${status}`, listingId: id });
    },
    onSuccess: () => {
      toast.success("Product updated");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicate = useMutation({
    mutationFn: async (l: PortalListing) => {
      const { error } = await supabase.from("listings").insert({
        developer_id: l.developer_id,
        slug: `${slugify(l.name)}-${Math.random().toString(36).slice(2, 6)}`,
        name: `${l.name} copy`,
        tagline: l.tagline,
        description: l.description,
        category: l.category,
        kind: l.kind,
        icon_url: l.icon_url,
        banner_url: l.banner_url,
        screenshots: l.screenshots,
        tags: l.tags,
        keywords: l.keywords,
        website_url: l.website_url,
        status: "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Duplicated as a draft");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("listings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product deleted");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const products = (data ?? []).filter(
    (l) =>
      (filter === "all" || l.status === filter) &&
      (!term.trim() || l.name.toLowerCase().includes(term.trim().toLowerCase())),
  );

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold">Products</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Apps, websites, AI agents and browser extensions you publish.
      </p>
      <div className="mt-4">
        <PortalTabs />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search your products"
          className="h-9 max-w-56"
        />
        {["all", ...PRODUCT_STATUSES].map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? "default" : "outline"}
            className="rounded-full capitalize"
            onClick={() => setFilter(s)}
          >
            {s}
          </Button>
        ))}
        <Button asChild size="sm" className="ml-auto rounded-full">
          <Link to="/upload">New product</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : products.length === 0 ? (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">
          Nothing here yet. Upload your first product to get started.
        </div>
      ) : (
        <ul className="space-y-3">
          {products.map((l) => (
            <li key={l.id} className="surface-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-display text-base font-semibold">{l.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {kindLabel(l.kind)} · {l.category} · {l.downloads} installs · {l.rating_avg || "—"} rating
                  </p>
                </div>
                <Badge variant={l.status === "published" ? "default" : "secondary"} className="capitalize">
                  {l.status}
                </Badge>
              </div>
              {l.rejection_reason && l.status === "rejected" && (
                <p className="mt-2 text-xs text-destructive">Reviewer note: {l.rejection_reason}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to="/manage/$id" params={{ id: l.id }}>
                    Edit
                  </Link>
                </Button>
                {l.status !== "published" && (
                  <Button size="sm" onClick={() => setStatus.mutate({ id: l.id, status: "published" })}>
                    Publish
                  </Button>
                )}
                {l.status !== "draft" && (
                  <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: l.id, status: "draft" })}>
                    Move to draft
                  </Button>
                )}
                {l.status !== "archived" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setStatus.mutate({ id: l.id, status: "archived" })}
                  >
                    Archive
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: l.id, status: "draft" })}>
                    Restore
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => duplicate.mutate(l)}>
                  Duplicate
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => {
                    if (window.confirm(`Delete ${l.name}? This cannot be undone.`)) remove.mutate(l.id);
                  }}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
