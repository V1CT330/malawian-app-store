import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, Send, Star, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConsoleShell } from "@/components/console/ConsoleShell";
import { EmptyState, RowSkeletons, SectionCard, StatusPill } from "@/components/console/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/hooks/useSession";
import { useRequireDeveloper } from "@/hooks/useRequireDeveloper";
import { supabase } from "@/integrations/supabase/client";
import {
  canSubmit,
  metricLabel,
  readinessScore,
  STATUS_HELP,
  submissionRequirements,
} from "@/lib/console";
import { useListing } from "@/lib/console.queries";
import {
  asoReport,
  kindLabel,
  logActivity,
  type PortalListing,
  type PortalVersion,
} from "@/lib/portal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/console/products/$id")({
  head: () => ({
    meta: [
      { title: "Product Detail, Developer Console" },
      {
        name: "description",
        content:
          "Edit the store listing, ship releases, answer reviews and track store optimisation for one product.",
      },
      { property: "og:title", content: "Product Detail, Developer Console" },
      { property: "og:description", content: "Manage one product end to end." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductDetailPage,
});

const TABS = ["Overview", "Listing", "Releases", "Reviews", "Quality"] as const;
type Tab = (typeof TABS)[number];

type ReviewRow = {
  id: string;
  rating: number;
  body: string | null;
  created_at: string;
  developer_reply: string | null;
};

function ProductDetailPage() {
  useRequireDeveloper();
  const { id } = Route.useParams();
  const { userId } = useProfile();
  const queryClient = useQueryClient();
  const listingQuery = useListing(id);
  const listing = listingQuery.data;
  const [tab, setTab] = useState<Tab>("Overview");

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["console-listing", id] });
    void queryClient.invalidateQueries({ queryKey: ["console-listings", userId] });
  };

  const setStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("listings").update({ status }).eq("id", id);
      if (error) throw error;
      if (userId)
        await logActivity({
          ownerId: userId,
          actorId: userId,
          action: `listing ${status}`,
          listingId: id,
        });
    },
    onSuccess: (_d, status) => {
      invalidate();
      toast.success(
        status === "pending"
          ? "Submitted to the store review team."
          : `Product moved to ${status}.`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (listingQuery.isLoading) {
    return (
      <ConsoleShell title="Loading product">
        <RowSkeletons count={4} />
      </ConsoleShell>
    );
  }

  if (!listing) {
    return (
      <ConsoleShell title="Product not found">
        <EmptyState
          title="This product is not available"
          description="It may have been removed, or it belongs to another developer account."
          action={
            <Button asChild>
              <Link to="/console/products">Back to all products</Link>
            </Button>
          }
        />
      </ConsoleShell>
    );
  }

  return (
    <ConsoleShell
      title={listing.name}
      description={`${kindLabel(listing.kind)} · ${listing.category}`}
      breadcrumbs={[
        { label: "Console", to: "/console" },
        { label: "All products", to: "/console/products" },
        { label: listing.name },
      ]}
      actions={
        <>
          <StatusPill status={listing.status} />
          {listing.status === "published" && (
            <Button asChild variant="outline" size="sm">
              <Link to="/apps/$slug" params={{ slug: listing.slug }}>
                <ExternalLink className="mr-2 h-4 w-4" /> View in store
              </Link>
            </Button>
          )}
          {listing.status === "draft" && (
            <Button
              size="sm"
              disabled={!canSubmit(listing) || setStatus.isPending}
              onClick={() => setStatus.mutate("pending")}
            >
              <Send className="mr-2 h-4 w-4" /> Submit for review
            </Button>
          )}
          {listing.status === "pending" && (
            <Button size="sm" variant="outline" onClick={() => setStatus.mutate("draft")}>
              <Undo2 className="mr-2 h-4 w-4" /> Withdraw
            </Button>
          )}
          {listing.status === "rejected" && (
            <Button size="sm" onClick={() => setStatus.mutate("draft")}>
              Edit and resubmit
            </Button>
          )}
          {listing.status === "published" && (
            <Button size="sm" variant="outline" onClick={() => setStatus.mutate("archived")}>
              Unpublish
            </Button>
          )}
          {listing.status === "archived" && (
            <Button size="sm" onClick={() => setStatus.mutate("draft")}>
              Restore as draft
            </Button>
          )}
        </>
      }
    >
      <div className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              tab === t
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && <OverviewTab listing={listing} />}
      {tab === "Listing" && <ListingTab listing={listing} onSaved={invalidate} />}
      {tab === "Releases" && <ReleasesTab listing={listing} />}
      {tab === "Reviews" && <ReviewsTab listing={listing} />}
      {tab === "Quality" && <QualityTab listing={listing} />}
    </ConsoleShell>
  );
}

function OverviewTab({ listing }: { listing: PortalListing }) {
  const ready = readinessScore(listing);
  const reqs = submissionRequirements(listing);
  return (
    <div className="space-y-4">
      {listing.status === "rejected" && listing.rejection_reason && (
        <div className="surface-card border-l-4 border-l-brand-red p-4">
          <p className="text-sm font-medium">Review feedback</p>
          <p className="mt-1 text-sm text-muted-foreground">{listing.rejection_reason}</p>
        </div>
      )}
      <SectionCard title="Status">
        <p className="text-sm text-muted-foreground">{STATUS_HELP[listing.status]}</p>
      </SectionCard>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="surface-card p-4">
          <p className="text-xs text-muted-foreground capitalize">{metricLabel(listing.kind)}</p>
          <p className="mt-1 font-display text-[28px] font-bold leading-none tabular-nums">
            {listing.downloads}
          </p>
        </div>
        <div className="surface-card p-4">
          <p className="text-xs text-muted-foreground">Rating</p>
          <p className="mt-1 font-display text-[28px] font-bold leading-none tabular-nums">
            {listing.rating_count > 0 ? Number(listing.rating_avg).toFixed(1) : "N/A"}
          </p>
        </div>
        <div className="surface-card p-4">
          <p className="text-xs text-muted-foreground">Ratings</p>
          <p className="mt-1 font-display text-[28px] font-bold leading-none tabular-nums">
            {listing.rating_count}
          </p>
        </div>
        <div className="surface-card p-4">
          <p className="text-xs text-muted-foreground">Store score</p>
          <p className="mt-1 font-display text-[28px] font-bold leading-none tabular-nums">
            {asoReport(listing).score}
          </p>
        </div>
      </div>
      <SectionCard title="Submission checklist">
        <Progress value={ready} />
        <p className="mt-2 text-xs text-muted-foreground">{ready}% complete</p>
        <ul className="mt-3 divide-y divide-border">
          {reqs.map((r) => (
            <li key={r.label} className="flex items-start gap-3 py-2 text-sm">
              <span className={r.ok ? "text-brand-green" : "text-muted-foreground"}>
                {r.ok ? "Done" : "Todo"}
              </span>
              <span className="min-w-0 flex-1">
                {r.label}
                {!r.ok && <span className="block text-xs text-muted-foreground">{r.hint}</span>}
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}

function ListingTab({ listing, onSaved }: { listing: PortalListing; onSaved: () => void }) {
  const editable = listing.status !== "pending";
  const [form, setForm] = useState({
    name: listing.name,
    tagline: listing.tagline ?? "",
    description: listing.description ?? "",
    category: listing.category,
    website_url: listing.website_url ?? "",
    icon_url: listing.icon_url ?? "",
    tags: listing.tags.join(", "),
    keywords: listing.keywords.join(", "),
    screenshots: listing.screenshots.join("\n"),
  });

  useEffect(() => {
    setForm({
      name: listing.name,
      tagline: listing.tagline ?? "",
      description: listing.description ?? "",
      category: listing.category,
      website_url: listing.website_url ?? "",
      icon_url: listing.icon_url ?? "",
      tags: listing.tags.join(", "),
      keywords: listing.keywords.join(", "),
      screenshots: listing.screenshots.join("\n"),
    });
  }, [listing]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("listings")
        .update({
          name: form.name.trim(),
          tagline: form.tagline.trim() || null,
          description: form.description.trim() || null,
          category: form.category.trim(),
          website_url: form.website_url.trim() || null,
          icon_url: form.icon_url.trim() || null,
          tags: form.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          keywords: form.keywords
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          screenshots: form.screenshots
            .split("\n")
            .map((t) => t.trim())
            .filter(Boolean),
        })
        .eq("id", listing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      onSaved();
      toast.success("Store listing saved.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SectionCard title="Store listing">
      {!editable && (
        <p className="mb-3 text-sm text-muted-foreground">
          This product is in review. Withdraw it to make further edits.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="p-name">Product name</Label>
          <Input
            id="p-name"
            value={form.name}
            disabled={!editable}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="p-tagline">Short description</Label>
          <Input
            id="p-tagline"
            value={form.tagline}
            disabled={!editable}
            onChange={(e) => setForm({ ...form, tagline: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="p-desc">Full description</Label>
          <Textarea
            id="p-desc"
            rows={7}
            value={form.description}
            disabled={!editable}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="p-cat">Category</Label>
          <Input
            id="p-cat"
            value={form.category}
            disabled={!editable}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="p-site">Website address</Label>
          <Input
            id="p-site"
            value={form.website_url}
            disabled={!editable}
            onChange={(e) => setForm({ ...form, website_url: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="p-tags">Tags (comma separated)</Label>
          <Input
            id="p-tags"
            value={form.tags}
            disabled={!editable}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="p-keys">Keywords (comma separated)</Label>
          <Input
            id="p-keys"
            value={form.keywords}
            disabled={!editable}
            onChange={(e) => setForm({ ...form, keywords: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="p-icon">Icon image URL</Label>
          <Input
            id="p-icon"
            value={form.icon_url}
            disabled={!editable}
            onChange={(e) => setForm({ ...form, icon_url: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="p-shots">Screenshot URLs (one per line)</Label>
          <Textarea
            id="p-shots"
            rows={4}
            value={form.screenshots}
            disabled={!editable}
            onChange={(e) => setForm({ ...form, screenshots: e.target.value })}
          />
        </div>
      </div>
      <Button className="mt-4" disabled={!editable || save.isPending} onClick={() => save.mutate()}>
        Save listing
      </Button>
    </SectionCard>
  );
}

function ReleasesTab({ listing }: { listing: PortalListing }) {
  const queryClient = useQueryClient();
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");

  const versionsQuery = useQuery({
    queryKey: ["console-versions", listing.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_versions")
        .select("*")
        .eq("listing_id", listing.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PortalVersion[];
    },
  });

  const ship = useMutation({
    mutationFn: async () => {
      if (!version.trim()) throw new Error("Give the release a version number.");
      const { error } = await supabase.from("listing_versions").insert({
        listing_id: listing.id,
        version: version.trim(),
        release_notes: notes.trim() || null,
        channel: "production",
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setVersion("");
      setNotes("");
      void queryClient.invalidateQueries({ queryKey: ["console-versions", listing.id] });
      toast.success("Release submitted.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = versionsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <SectionCard title="Ship a release">
        <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
          <div>
            <Label htmlFor="v-num">Version</Label>
            <Input
              id="v-num"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.2.0"
            />
          </div>
          <div>
            <Label htmlFor="v-notes">Release notes</Label>
            <Input
              id="v-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What changed in this release"
            />
          </div>
        </div>
        <Button className="mt-3" disabled={ship.isPending} onClick={() => ship.mutate()}>
          Submit release
        </Button>
      </SectionCard>

      <SectionCard title="Release history">
        {versionsQuery.isLoading ? (
          <RowSkeletons count={2} />
        ) : rows.length === 0 ? (
          <EmptyState title="No releases yet" description="Ship your first version above." />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((v) => (
              <li key={v.id} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    Version {v.version}
                    {v.is_current && <span className="ml-2 text-xs text-brand-green">current</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(v.created_at).toLocaleDateString()} · {v.channel}
                  </p>
                  {v.release_notes && (
                    <p className="mt-1 text-sm text-muted-foreground">{v.release_notes}</p>
                  )}
                </div>
                <StatusPill status={v.status} />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function ReviewsTab({ listing }: { listing: PortalListing }) {
  const queryClient = useQueryClient();
  const [replies, setReplies] = useState<Record<string, string>>({});

  const reviewsQuery = useQuery({
    queryKey: ["console-reviews", listing.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("id,rating,body,created_at,developer_reply")
        .eq("listing_id", listing.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ReviewRow[];
    },
  });

  const reply = useMutation({
    mutationFn: async (reviewId: string) => {
      const text = (replies[reviewId] ?? "").trim();
      if (!text) throw new Error("Write a reply first.");
      const { error } = await supabase
        .from("reviews")
        .update({ developer_reply: text, replied_at: new Date().toISOString() })
        .eq("id", reviewId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["console-reviews", listing.id] });
      toast.success("Reply published.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = reviewsQuery.data ?? [];

  return (
    <SectionCard title={`Reviews (${rows.length})`}>
      {reviewsQuery.isLoading ? (
        <RowSkeletons count={3} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No reviews yet"
          description="Reviews appear here once people start using this product."
        />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="py-4">
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "h-4 w-4",
                      i < r.rating ? "fill-[#F5B301] text-[#F5B301]" : "text-muted-foreground",
                    )}
                  />
                ))}
                <span className="ml-2 text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
              </div>
              {r.body && <p className="mt-2 text-sm">{r.body}</p>}
              {r.developer_reply ? (
                <p className="mt-2 rounded-xl bg-secondary p-3 text-sm">
                  <span className="font-medium">Your reply: </span>
                  {r.developer_reply}
                </p>
              ) : (
                <div className="mt-2 flex gap-2">
                  <Input
                    aria-label="Reply to this review"
                    value={replies[r.id] ?? ""}
                    onChange={(e) => setReplies({ ...replies, [r.id]: e.target.value })}
                    placeholder="Reply to this review"
                  />
                  <Button size="sm" disabled={reply.isPending} onClick={() => reply.mutate(r.id)}>
                    Reply
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function QualityTab({ listing }: { listing: PortalListing }) {
  const report = asoReport(listing);
  return (
    <SectionCard title="Store optimisation">
      <Progress value={report.score} />
      <p className="mt-2 text-xs text-muted-foreground">{report.score}/100 store readiness score</p>
      <ul className="mt-4 divide-y divide-border">
        {report.checks.map((c) => (
          <li key={c.label} className="flex items-center gap-3 py-2.5 text-sm">
            <span className={c.ok ? "text-brand-green" : "text-brand-red"}>
              {c.ok ? "Pass" : "Fix"}
            </span>
            <span className="min-w-0 flex-1">{c.label}</span>
            <span className="text-xs text-muted-foreground">{c.weight} pts</span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
