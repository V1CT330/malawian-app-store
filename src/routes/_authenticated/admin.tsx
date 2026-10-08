import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield } from "lucide-react";
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
import { type Listing } from "@/lib/store";

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

  const claim = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("claim_first_admin");
      if (error) throw error;
      if (!data) throw new Error("An administrator already exists for this store.");
    },
    onSuccess: () => {
      toast.success("You are now an administrator");
      queryClient.invalidateQueries({ queryKey: ["is-admin", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
            This area is for store administrators. If you are setting the store up, you can claim
            the first administrator account.
          </p>
          <Button onClick={() => claim.mutate()} disabled={claim.isPending}>
            Claim admin access
          </Button>
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
