import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Shield } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useIsAdmin, useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { signedAssetUrl, type Listing } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Panel, Malawian App Store" },
      {
        name: "description",
        content:
          "Review submissions, moderate reports, feature apps, manage developers and send notifications.",
      },
      { property: "og:title", content: "Admin Panel, Malawian App Store" },
      { property: "og:description", content: "Moderation and platform management." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type ProfileRow = {
  id: string;
  display_name: string | null;
  developer_name: string | null;
  kyc_status: string;
  suspended: boolean;
  is_developer: boolean;
};

function AdminPage() {
  const { userId } = useSession();
  const isAdmin = useIsAdmin();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState({ title: "", body: "" });

  const listings = useQuery({
    queryKey: ["admin-listings"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Listing[];
    },
  });

  const releases = useQuery({
    queryKey: ["admin-releases"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_versions")
        .select("id,listing_id,version,release_notes,file_url,size_bytes,status,created_at,listings(name,slug,developer_id)")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const reports = useQuery({
    queryKey: ["admin-reports"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*, listings(name,slug)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const people = useQuery({
    queryKey: ["admin-people"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,display_name,developer_name,kyc_status,suspended,is_developer")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });

  const kyc = useQuery({
    queryKey: ["admin-kyc"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kyc_submissions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const decide = useMutation({
    mutationFn: async ({
      listing,
      status,
      reason,
    }: {
      listing: Listing;
      status: "published" | "rejected" | "pending";
      reason?: string;
    }) => {
      const { error } = await supabase
        .from("listings")
        .update({ status, rejection_reason: reason ?? null })
        .eq("id", listing.id);
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: listing.developer_id,
        title: `${listing.name} was ${status}`,
        body: reason || `Your listing status is now ${status}.`,
      });
    },
    onSuccess: () => {
      toast.success("Decision saved");
      queryClient.invalidateQueries({ queryKey: ["admin-listings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decideRelease = useMutation({
    mutationFn: async ({
      id,
      status,
      version,
      listingName,
      developerId,
      reason,
    }: {
      id: string;
      status: "released" | "rejected";
      version: string;
      listingName: string;
      developerId: string;
      reason?: string;
    }) => {
      const { error } = await supabase
        .from("listing_versions")
        .update({ status })
        .eq("id", id)
        .eq("status", "pending");
      if (error) throw error;
      const { error: notificationError } = await supabase.from("notifications").insert({
        user_id: developerId,
        title: `Release ${version} ${status === "released" ? "approved" : "rejected"}`,
        body:
          status === "released"
            ? `${listingName} version ${version} is approved and available for download.`
            : reason || `${listingName} version ${version} was rejected. Please contact store support for details.`,
      });
      if (notificationError) console.warn("Release decision saved, but developer notification failed.");
    },
    onSuccess: (_result, variables) => {
      toast.success(variables.status === "released" ? "Release approved" : "Release rejected");
      void queryClient.invalidateQueries({ queryKey: ["admin-releases"] });
      void queryClient.invalidateQueries({ queryKey: ["versions"] });
      void queryClient.invalidateQueries({ queryKey: ["listing"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function openReleasePackage(path: string | null) {
    if (!path) {
      toast.error("This release has no package file.");
      return;
    }
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      toast.error("Allow pop-ups to review the release package.");
      return;
    }
    tab.opener = null;
    const url = await signedAssetUrl(path);
    if (!url) {
      tab.close();
      toast.error("Could not create a secure package link.");
      return;
    }
    tab.location.href = url;
  }

  const feature = useMutation({
    mutationFn: async ({ id, featured }: { id: string; featured: boolean }) => {
      const { error } = await supabase.from("listings").update({ featured }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-listings"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const resolveReport = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("reports").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-reports"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const suspend = useMutation({
    mutationFn: async ({ id, suspended }: { id: string; suspended: boolean }) => {
      const { error } = await supabase.from("profiles").update({ suspended }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-people"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const decideKyc = useMutation({
    mutationFn: async ({
      id,
      user_id,
      status,
    }: {
      id: string;
      user_id: string;
      status: "approved" | "rejected";
    }) => {
      const { error } = await supabase.from("kyc_submissions").update({ status }).eq("id", id);
      if (error) throw error;
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ kyc_status: status })
        .eq("id", user_id);
      if (pErr) throw pErr;
      await supabase.from("notifications").insert({
        user_id,
        title: `KYC ${status}`,
        body:
          status === "approved"
            ? "Your verified developer badge is live."
            : "Please resubmit your documents.",
      });
    },
    onSuccess: () => {
      toast.success("KYC updated");
      queryClient.invalidateQueries({ queryKey: ["admin-kyc"] });
      queryClient.invalidateQueries({ queryKey: ["admin-people"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const broadcast = useMutation({
    mutationFn: async () => {
      if (notice.title.trim().length < 3) throw new Error("Add a title for the notification.");
      const rows = (people.data ?? []).map((p) => ({
        user_id: p.id,
        title: notice.title.trim(),
        body: notice.body.trim() || null,
      }));
      if (!rows.length) throw new Error("No recipients found.");
      const { error } = await supabase.from("notifications").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notification sent");
      setNotice({ title: "", body: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="surface-card mt-6 space-y-3 p-6 text-center">
          <Shield className="mx-auto h-6 w-6 text-muted-foreground" />
          <h1 className="font-display text-xl font-bold">Admin panel</h1>
          <p className="text-sm text-muted-foreground">
            This area is restricted to store administrators. For security, administrator access
            cannot be claimed from a public sign-in session. The platform owner must provision an
            administrator account through a trusted operator process.
          </p>
        </div>
      </AppShell>
    );
  }

  const pending = (listings.data ?? []).filter(
    (l) => l.status === "pending" || l.status === "draft",
  );

  return (
    <AppShell>
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
        <Shield className="h-5 w-5" /> Admin panel
      </h1>

      <Tabs defaultValue="review" className="mt-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="review">Review</TabsTrigger>
          <TabsTrigger value="releases">Releases</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="kyc">KYC</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="notify">Notify</TabsTrigger>
        </TabsList>

        <TabsContent value="review" className="mt-4 space-y-3">
          {listings.isLoading ? (
            <Skeleton className="h-24 w-full rounded-2xl" />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{pending.length} awaiting review</p>
              {(listings.data ?? []).map((l) => (
                <article key={l.id} className="surface-card space-y-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to="/apps/$slug"
                        params={{ slug: l.slug }}
                        className="font-medium underline"
                      >
                        {l.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {l.kind} · {l.category} · {l.downloads} installs
                      </p>
                    </div>
                    <Badge variant="secondary" className="capitalize">
                      {l.status}
                    </Badge>
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{l.description}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => decide.mutate({ listing: l, status: "published" })}
                    >
                      Approve & publish
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const reason =
                          window.prompt("Reason for rejection (shown to the developer)") ?? "";
                        if (reason) decide.mutate({ listing: l, status: "rejected", reason });
                      }}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => feature.mutate({ id: l.id, featured: !l.featured })}
                    >
                      {l.featured ? "Unfeature" : "Feature"}
                    </Button>
                  </div>
                </article>
              ))}
            </>
          )}
        </TabsContent>

        <TabsContent value="releases" className="mt-4 space-y-3">
          {releases.isLoading ? (
            <Skeleton className="h-24 w-full rounded-2xl" />
          ) : (releases.data ?? []).length === 0 ? (
            <p className="surface-card p-6 text-center text-sm text-muted-foreground">
              No release packages are awaiting review.
            </p>
          ) : (
            (releases.data ?? []).map((release) => {
              const product = release.listings as
                | { name: string; slug: string; developer_id: string }
                | null;
              if (!product) return null;
              return (
                <article key={release.id} className="surface-card space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to="/apps/$slug"
                        params={{ slug: product.slug }}
                        className="font-medium underline"
                      >
                        {product.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        Version {release.version} · {release.size_bytes ? `${(release.size_bytes / (1024 * 1024)).toFixed(1)} MB` : "size unknown"}
                      </p>
                      {release.release_notes && (
                        <p className="mt-1 text-sm">{release.release_notes}</p>
                      )}
                    </div>
                    <Badge variant="secondary">pending</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void openReleasePackage(release.file_url)}
                    >
                      <Download className="mr-1.5 h-4 w-4" /> Review package
                    </Button>
                    <Button
                      size="sm"
                      disabled={decideRelease.isPending || !release.file_url}
                      onClick={() =>
                        decideRelease.mutate({
                          id: release.id,
                          status: "released",
                          version: release.version,
                          listingName: product.name,
                          developerId: product.developer_id,
                        })
                      }
                    >
                      Approve release
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={decideRelease.isPending}
                      onClick={() => {
                        const reason = window.prompt("Reason for rejecting this release package") ?? "";
                        if (reason.trim()) {
                          decideRelease.mutate({
                            id: release.id,
                            status: "rejected",
                            version: release.version,
                            listingName: product.name,
                            developerId: product.developer_id,
                            reason: reason.trim(),
                          });
                        }
                      }}
                    >
                      Reject release
                    </Button>
                  </div>
                </article>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="reports" className="mt-4 space-y-3">
          {(reports.data ?? []).length === 0 && (
            <p className="surface-card p-6 text-center text-sm text-muted-foreground">
              No reports.
            </p>
          )}
          {(reports.data ?? []).map((r) => (
            <article key={r.id} className="surface-card space-y-2 p-4">
              <p className="font-medium">
                {r.kind} , {(r.listings as { name?: string } | null)?.name ?? "listing"}
              </p>
              {r.details && <p className="text-sm text-muted-foreground">{r.details}</p>}
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{r.status}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => resolveReport.mutate({ id: r.id, status: "resolved" })}
                >
                  Resolve
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => resolveReport.mutate({ id: r.id, status: "dismissed" })}
                >
                  Dismiss
                </Button>
              </div>
            </article>
          ))}
        </TabsContent>

        <TabsContent value="kyc" className="mt-4 space-y-3">
          {(kyc.data ?? []).length === 0 && (
            <p className="surface-card p-6 text-center text-sm text-muted-foreground">
              No submissions.
            </p>
          )}
          {(kyc.data ?? []).map((k) => (
            <article key={k.id} className="surface-card space-y-2 p-4">
              <p className="font-medium">{k.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {k.id_type} · {k.id_number} · {k.status}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    decideKyc.mutate({ id: k.id, user_id: k.user_id, status: "approved" })
                  }
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    decideKyc.mutate({ id: k.id, user_id: k.user_id, status: "rejected" })
                  }
                >
                  Reject
                </Button>
              </div>
            </article>
          ))}
        </TabsContent>

        <TabsContent value="people" className="mt-4 space-y-3">
          {(people.data ?? []).map((p) => (
            <article
              key={p.id}
              className="surface-card flex items-center justify-between gap-3 p-4"
            >
              <div className="min-w-0">
                <Link
                  to="/developers/$id"
                  params={{ id: p.id }}
                  className="truncate font-medium underline"
                >
                  {p.developer_name || p.display_name || "Unnamed account"}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {p.is_developer ? "Developer" : "User"} · KYC {p.kyc_status}
                  {p.suspended && " · suspended"}
                </p>
              </div>
              <Button
                size="sm"
                variant={p.suspended ? "outline" : "destructive"}
                onClick={() => suspend.mutate({ id: p.id, suspended: !p.suspended })}
              >
                {p.suspended ? "Restore" : "Suspend"}
              </Button>
            </article>
          ))}
        </TabsContent>

        <TabsContent value="notify" className="mt-4 space-y-3">
          <div className="surface-card space-y-3 p-4">
            <Input
              placeholder="Notification title"
              value={notice.title}
              maxLength={80}
              onChange={(e) => setNotice((n) => ({ ...n, title: e.target.value }))}
            />
            <Textarea
              rows={3}
              maxLength={400}
              placeholder="Message"
              value={notice.body}
              onChange={(e) => setNotice((n) => ({ ...n, body: e.target.value }))}
            />
            <Button size="sm" disabled={broadcast.isPending} onClick={() => broadcast.mutate()}>
              Send to all accounts
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
