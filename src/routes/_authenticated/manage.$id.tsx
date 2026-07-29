import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { formatBytes, uploadAsset, type Listing } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/manage/$id")({
  head: () => ({
    meta: [
      { title: "Manage Listing — Malawian App Store" },
      {
        name: "description",
        content: "Edit your listing details and ship a new version with a changelog and build file.",
      },
      { property: "og:title", content: "Manage Listing — Malawian App Store" },
      { property: "og:description", content: "Edit listing details and ship new versions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManagePage,
});

function ManagePage() {
  const { id } = Route.useParams();
  const { userId } = useSession();
  const queryClient = useQueryClient();

  const [version, setVersion] = useState("");
  const [changelog, setChangelog] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState<string | null>(null);

  const listingQuery = useQuery({
    queryKey: ["listing-by-id", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("listings").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Listing | null;
    },
  });
  const listing = listingQuery.data ?? null;

  const versionsQuery = useQuery({
    queryKey: ["versions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_versions")
        .select("*")
        .eq("listing_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveDetails = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("listings")
        .update({ description: description ?? listing?.description ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Listing updated");
      queryClient.invalidateQueries({ queryKey: ["listing-by-id", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const shipVersion = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sign in required");
      if (!version.trim()) throw new Error("Enter a version number");
      const filePath = file ? await uploadAsset(userId, file, "builds") : null;
      const { error } = await supabase.from("listing_versions").insert({
        listing_id: id,
        version: version.trim(),
        changelog: changelog.trim() || null,
        file_url: filePath,
        size_bytes: file?.size ?? null,
      });
      if (error) throw error;
      await supabase.from("listings").update({ updated_at: new Date().toISOString() }).eq("id", id);
    },
    onSuccess: () => {
      toast.success("New version published");
      setVersion("");
      setChangelog("");
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["versions", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (listingQuery.isLoading) {
    return (
      <AppShell>
        <Skeleton className="h-40 w-full rounded-2xl" />
      </AppShell>
    );
  }

  if (!listing || listing.developer_id !== userId) {
    return (
      <AppShell>
        <div className="surface-card p-8 text-center">
          <h1 className="font-display text-lg font-semibold">Listing unavailable</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You can only manage listings you published.
          </p>
          <Button asChild className="mt-4">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{listing.name}</h1>
          <p className="text-sm text-muted-foreground">Manage details and versions</p>
        </div>
        <Badge variant="secondary" className="capitalize">
          {listing.status}
        </Badge>
      </div>

      <section className="surface-card mt-5 p-4">
        <h2 className="mb-2 font-display text-base font-semibold">Description</h2>
        <Textarea
          rows={5}
          maxLength={2000}
          value={description ?? listing.description ?? ""}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Button
          className="mt-3"
          size="sm"
          disabled={saveDetails.isPending}
          onClick={() => saveDetails.mutate()}
        >
          Save changes
        </Button>
      </section>

      <section className="surface-card mt-4 p-4">
        <h2 className="mb-3 font-display text-base font-semibold">Ship an update</h2>
        <div className="space-y-3">
          <div>
            <Label htmlFor="version">Version</Label>
            <Input
              id="version"
              value={version}
              placeholder="1.1.0"
              onChange={(e) => setVersion(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="changelog">What's new</Label>
            <Textarea
              id="changelog"
              rows={3}
              maxLength={800}
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="build">Build file (optional)</Label>
            <Input id="build" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <Button disabled={shipVersion.isPending} onClick={() => shipVersion.mutate()}>
            {shipVersion.isPending ? "Publishing…" : "Publish version"}
          </Button>
        </div>
      </section>

      <section className="surface-card mt-4 p-4">
        <h2 className="mb-2 font-display text-base font-semibold">Version history</h2>
        {versionsQuery.data?.length ? (
          <ul className="space-y-3">
            {versionsQuery.data.map((v) => (
              <li key={v.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                <p className="text-sm font-medium">v{v.version}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(v.created_at).toLocaleDateString()} · {formatBytes(v.size_bytes)}
                </p>
                {v.changelog && <p className="mt-1 text-sm text-muted-foreground">{v.changelog}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No versions yet.</p>
        )}
      </section>
    </AppShell>
  );
}
