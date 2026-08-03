import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { asoReport, kindLabel, logActivity, type PortalListing, type PortalVersion } from "@/lib/portal";
import { AI_TASKS, publishingAssist } from "@/lib/publishing.functions";
import { CATEGORIES, formatBytes, uploadAsset } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/manage/$id")({
  head: () => ({
    meta: [
      { title: "Manage Product — Malawian App Store" },
      {
        name: "description",
        content: "Edit listings, manage media, ship versions, run beta tests, reply to reviews and optimise for search.",
      },
      { property: "og:title", content: "Manage Product — Malawian App Store" },
      { property: "og:description", content: "Everything about one product in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManagePage,
});

const AI_LABELS: Record<(typeof AI_TASKS)[number], string> = {
  description: "Generate description",
  keywords: "Generate keywords",
  release_notes: "Write release notes",
  translate: "Translate listing",
  grammar: "Check grammar",
  quality: "Analyse quality",
  titles: "Suggest titles",
  screenshots: "Screenshot advice",
  seo: "Improve SEO",
};

type Review = {
  id: string;
  rating: number;
  body: string | null;
  developer_reply: string | null;
  created_at: string;
};

function ManagePage() {
  const { id } = Route.useParams();
  const { userId } = useSession();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<Partial<PortalListing>>({});
  const [version, setVersion] = useState("");
  const [changelog, setChangelog] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [channel, setChannel] = useState("stable");
  const [scheduledAt, setScheduledAt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [testerEmail, setTesterEmail] = useState("");
  const [announceTitle, setAnnounceTitle] = useState("");
  const [announceBody, setAnnounceBody] = useState("");
  const [aiTask, setAiTask] = useState<(typeof AI_TASKS)[number]>("description");
  const [aiOutput, setAiOutput] = useState("");
  const [replies, setReplies] = useState<Record<string, string>>({});

  const listingQuery = useQuery({
    queryKey: ["listing-by-id", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("listings").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as PortalListing | null;
    },
  });
  const listing = listingQuery.data ?? null;
  const value = <K extends keyof PortalListing>(key: K): PortalListing[K] | undefined =>
    (form[key] ?? listing?.[key]) as PortalListing[K] | undefined;

  const versionsQuery = useQuery({
    queryKey: ["versions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_versions")
        .select("*")
        .eq("listing_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PortalVersion[];
    },
  });

  const testersQuery = useQuery({
    queryKey: ["beta-testers", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beta_testers")
        .select("id,email,channel,status,created_at")
        .eq("listing_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const feedbackQuery = useQuery({
    queryKey: ["beta-feedback", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beta_feedback")
        .select("id,kind,severity,body,status,created_at")
        .eq("listing_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const reviewsQuery = useQuery({
    queryKey: ["product-reviews", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("id,rating,body,developer_reply,created_at")
        .eq("listing_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Review[];
    },
  });

  const announcementsQuery = useQuery({
    queryKey: ["announcements", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id,title,body,pinned,created_at")
        .eq("listing_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveDetails = useMutation({
    mutationFn: async (patch?: Partial<PortalListing>) => {
      const next = { ...form, ...patch };
      const { error } = await supabase
        .from("listings")
        .update({
          name: next.name ?? listing?.name,
          tagline: next.tagline ?? listing?.tagline ?? null,
          description: next.description ?? listing?.description ?? null,
          category: next.category ?? listing?.category,
          tags: next.tags ?? listing?.tags ?? [],
          keywords: next.keywords ?? listing?.keywords ?? [],
          icon_url: next.icon_url ?? listing?.icon_url ?? null,
          banner_url: next.banner_url ?? listing?.banner_url ?? null,
          video_url: next.video_url ?? listing?.video_url ?? null,
          screenshots: next.screenshots ?? listing?.screenshots ?? [],
          promo_images: next.promo_images ?? listing?.promo_images ?? [],
        })
        .eq("id", id);
      if (error) throw error;
      if (userId) await logActivity({ ownerId: userId, actorId: userId, action: "Updated listing", listingId: id });
    },
    onSuccess: () => {
      toast.success("Listing saved");
      queryClient.invalidateQueries({ queryKey: ["listing-by-id", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadMedia = useMutation({
    mutationFn: async ({ kind, files }: { kind: "icon" | "banner" | "screenshots" | "promo"; files: FileList }) => {
      if (!userId) throw new Error("Sign in required");
      const paths: string[] = [];
      for (const f of Array.from(files)) paths.push(await uploadAsset(userId, f, "media"));
      if (kind === "icon") setForm((f) => ({ ...f, icon_url: paths[0] }));
      if (kind === "banner") setForm((f) => ({ ...f, banner_url: paths[0] }));
      if (kind === "screenshots")
        setForm((f) => ({ ...f, screenshots: [...(f.screenshots ?? listing?.screenshots ?? []), ...paths] }));
      if (kind === "promo")
        setForm((f) => ({ ...f, promo_images: [...(f.promo_images ?? listing?.promo_images ?? []), ...paths] }));
    },
    onSuccess: () => toast.success("Uploaded. Remember to save."),
    onError: (e: Error) => toast.error(e.message),
  });

  const shipVersion = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sign in required");
      if (!version.trim()) throw new Error("Enter a version number");
      const filePath = file ? await uploadAsset(userId, file, "builds") : null;
      const scheduled = scheduledAt ? new Date(scheduledAt).toISOString() : null;
      const status = scheduled && new Date(scheduled) > new Date() ? "scheduled" : "released";
      if (status === "released" && channel === "stable") {
        await supabase.from("listing_versions").update({ is_current: false }).eq("listing_id", id);
      }
      const { error } = await supabase.from("listing_versions").insert({
        listing_id: id,
        version: version.trim(),
        changelog: changelog.trim() || null,
        release_notes: releaseNotes.trim() || null,
        channel,
        status,
        scheduled_at: scheduled,
        is_current: status === "released" && channel === "stable",
        file_url: filePath,
        size_bytes: file?.size ?? null,
      });
      if (error) throw error;
      await supabase.from("listings").update({ updated_at: new Date().toISOString() }).eq("id", id);
      await logActivity({ ownerId: userId, actorId: userId, action: `Shipped v${version.trim()} (${channel})`, listingId: id });
    },
    onSuccess: () => {
      toast.success("Version saved");
      setVersion("");
      setChangelog("");
      setReleaseNotes("");
      setFile(null);
      setScheduledAt("");
      queryClient.invalidateQueries({ queryKey: ["versions", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rollback = useMutation({
    mutationFn: async (v: PortalVersion) => {
      await supabase.from("listing_versions").update({ is_current: false }).eq("listing_id", id);
      const { error } = await supabase
        .from("listing_versions")
        .update({ is_current: true, status: "released" })
        .eq("id", v.id);
      if (error) throw error;
      if (userId) await logActivity({ ownerId: userId, actorId: userId, action: `Rolled back to v${v.version}`, listingId: id });
    },
    onSuccess: () => {
      toast.success("Rolled back");
      queryClient.invalidateQueries({ queryKey: ["versions", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const inviteTester = useMutation({
    mutationFn: async (testerChannel: string) => {
      if (!userId) throw new Error("Sign in required");
      const clean = testerEmail.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new Error("Enter a valid email address");
      const { error } = await supabase
        .from("beta_testers")
        .insert({ listing_id: id, owner_id: userId, email: clean, channel: testerChannel });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tester invited");
      setTesterEmail("");
      queryClient.invalidateQueries({ queryKey: ["beta-testers", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const replyToReview = useMutation({
    mutationFn: async (reviewId: string) => {
      const text = (replies[reviewId] ?? "").trim();
      if (!text) throw new Error("Write a reply first");
      const { error } = await supabase
        .from("reviews")
        .update({ developer_reply: text, replied_at: new Date().toISOString() })
        .eq("id", reviewId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reply published");
      queryClient.invalidateQueries({ queryKey: ["product-reviews", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const publishAnnouncement = useMutation({
    mutationFn: async (pinned: boolean) => {
      if (!userId) throw new Error("Sign in required");
      if (announceTitle.trim().length < 3) throw new Error("Give the announcement a title");
      const { error } = await supabase.from("announcements").insert({
        developer_id: userId,
        listing_id: id,
        title: announceTitle.trim(),
        body: announceBody.trim() || null,
        pinned,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Announcement published");
      setAnnounceTitle("");
      setAnnounceBody("");
      queryClient.invalidateQueries({ queryKey: ["announcements", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runAi = useMutation({
    mutationFn: async () => {
      const result = await publishingAssist({
        data: {
          task: aiTask,
          name: value("name") ?? "",
          tagline: value("tagline") ?? "",
          description: value("description") ?? "",
          category: value("category") ?? "",
          kind: value("kind") ?? "app",
          extra: changelog,
          language: "Chichewa",
        },
      });
      return result.text;
    },
    onSuccess: (text) => setAiOutput(text),
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
          <h1 className="font-display text-lg font-semibold">Product unavailable</h1>
          <p className="mt-1 text-sm text-muted-foreground">You can only manage products you published.</p>
          <Button asChild className="mt-4">
            <Link to="/products">Back to products</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const aso = asoReport({ ...listing, ...form });

  return (
    <AppShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{listing.name}</h1>
          <p className="text-sm text-muted-foreground">
            {kindLabel(listing.kind)} · {listing.downloads} installs · {listing.rating_avg || "—"} ★
          </p>
        </div>
        <Badge variant="secondary" className="capitalize">
          {listing.status}
        </Badge>
      </div>

      <Tabs defaultValue="listing" className="mt-5">
        <TabsList className="flex w-full flex-wrap">
          <TabsTrigger value="listing">Listing</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="beta">Beta</TabsTrigger>
          <TabsTrigger value="engage">Engagement</TabsTrigger>
          <TabsTrigger value="aso">ASO & AI</TabsTrigger>
        </TabsList>

        <TabsContent value="listing" className="space-y-3">
          <div className="surface-card space-y-3 p-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                maxLength={60}
                value={value("name") ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="tagline">Tagline</Label>
              <Input
                id="tagline"
                maxLength={90}
                value={value("tagline") ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={6}
                maxLength={2000}
                value={value("description") ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select
                value={value("category") ?? CATEGORIES[0]}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="tags">Tags (comma separated)</Label>
              <Input
                id="tags"
                value={(value("tags") ?? []).join(", ")}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) }))
                }
              />
            </div>
            <div>
              <Label htmlFor="keywords">Search keywords (comma separated)</Label>
              <Input
                id="keywords"
                value={(value("keywords") ?? []).join(", ")}
                onChange={(e) =>
                  setForm((f) => ({ ...f, keywords: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) }))
                }
              />
            </div>
            <Button size="sm" disabled={saveDetails.isPending} onClick={() => saveDetails.mutate(undefined)}>
              Save changes
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="media">
          <div className="surface-card space-y-3 p-4">
            <p className="text-sm text-muted-foreground">
              Upload the icon, feature banner, screenshots and promotional images. Save after uploading.
            </p>
            <div>
              <Label htmlFor="icon">Icon</Label>
              <Input
                id="icon"
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files && uploadMedia.mutate({ kind: "icon", files: e.target.files })}
              />
            </div>
            <div>
              <Label htmlFor="banner">Feature banner</Label>
              <Input
                id="banner"
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files && uploadMedia.mutate({ kind: "banner", files: e.target.files })}
              />
            </div>
            <div>
              <Label htmlFor="shots">Screenshots</Label>
              <Input
                id="shots"
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => e.target.files && uploadMedia.mutate({ kind: "screenshots", files: e.target.files })}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {(value("screenshots") ?? []).length} screenshot(s) attached
              </p>
            </div>
            <div>
              <Label htmlFor="promo">Promotional images</Label>
              <Input
                id="promo"
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => e.target.files && uploadMedia.mutate({ kind: "promo", files: e.target.files })}
              />
            </div>
            <div>
              <Label htmlFor="video">Video URL</Label>
              <Input
                id="video"
                value={value("video_url") ?? ""}
                placeholder="https://youtube.com/..."
                onChange={(e) => setForm((f) => ({ ...f, video_url: e.target.value }))}
              />
            </div>
            <Button size="sm" onClick={() => saveDetails.mutate(undefined)}>
              Save media
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="versions" className="space-y-3">
          <div className="surface-card space-y-3 p-4">
            <h2 className="font-display text-base font-semibold">Ship an update</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="version">Version</Label>
                <Input id="version" value={version} placeholder="1.1.0" onChange={(e) => setVersion(e.target.value)} />
              </div>
              <div>
                <Label>Channel</Label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stable">Stable</SelectItem>
                    <SelectItem value="public_beta">Public beta</SelectItem>
                    <SelectItem value="private_beta">Private beta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="changelog">Changelog</Label>
              <Textarea id="changelog" rows={3} maxLength={800} value={changelog} onChange={(e) => setChangelog(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="notes">Release notes shown to users</Label>
              <Textarea id="notes" rows={3} maxLength={800} value={releaseNotes} onChange={(e) => setReleaseNotes(e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="schedule">Schedule release (optional)</Label>
                <Input id="schedule" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="build">Build file (optional)</Label>
                <Input id="build" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>
            <Button disabled={shipVersion.isPending} onClick={() => shipVersion.mutate()}>
              {shipVersion.isPending ? "Publishing…" : "Publish version"}
            </Button>
          </div>

          <div className="surface-card p-4">
            <h2 className="mb-2 font-display text-base font-semibold">Version history</h2>
            {versionsQuery.data?.length ? (
              <ul className="space-y-3">
                {versionsQuery.data.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-start gap-2 border-b border-border pb-3 last:border-0 last:pb-0">
                    <div className="mr-auto">
                      <p className="text-sm font-medium">
                        v{v.version} {v.is_current && <Badge className="ml-1">Current</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(v.created_at).toLocaleDateString()} · {formatBytes(v.size_bytes)} · {v.channel} · {v.status}
                        {v.scheduled_at ? ` · scheduled ${new Date(v.scheduled_at).toLocaleString()}` : ""}
                      </p>
                      {v.changelog && <p className="mt-1 text-sm text-muted-foreground">{v.changelog}</p>}
                    </div>
                    {!v.is_current && (
                      <Button size="sm" variant="outline" onClick={() => rollback.mutate(v)}>
                        Roll back to this
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No versions yet.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="beta" className="space-y-3">
          <div className="surface-card space-y-3 p-4">
            <h2 className="font-display text-base font-semibold">Invite testers</h2>
            <Input
              value={testerEmail}
              onChange={(e) => setTesterEmail(e.target.value)}
              placeholder="tester@example.mw"
              maxLength={255}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => inviteTester.mutate("private_beta")}>
                Invite to private beta
              </Button>
              <Button size="sm" variant="outline" onClick={() => inviteTester.mutate("public_beta")}>
                Invite to public beta
              </Button>
            </div>
            <ul className="space-y-2 text-sm">
              {testersQuery.data?.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2">
                  <span>{t.email}</span>
                  <span className="text-xs capitalize text-muted-foreground">
                    {t.channel.replace("_", " ")} · {t.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="surface-card p-4">
            <h2 className="mb-2 font-display text-base font-semibold">Tester feedback and bug reports</h2>
            <p className="mb-2 text-xs text-muted-foreground">
              {testersQuery.data?.length ?? 0} testers · {feedbackQuery.data?.length ?? 0} reports
            </p>
            {feedbackQuery.data?.length ? (
              <ul className="space-y-2 text-sm">
                {feedbackQuery.data.map((f) => (
                  <li key={f.id} className="border-b border-border pb-2 last:border-0">
                    <p className="font-medium capitalize">
                      {f.kind} · {f.severity}
                    </p>
                    <p className="text-muted-foreground">{f.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No feedback yet.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="engage" className="space-y-3">
          <div className="surface-card p-4">
            <h2 className="mb-3 font-display text-base font-semibold">Reviews</h2>
            {reviewsQuery.data?.length ? (
              <ul className="space-y-4">
                {reviewsQuery.data.map((r) => (
                  <li key={r.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                    <p className="text-sm font-medium">{r.rating} ★</p>
                    {r.body && <p className="text-sm text-muted-foreground">{r.body}</p>}
                    {r.developer_reply ? (
                      <p className="mt-2 rounded-lg bg-secondary p-2 text-sm">Your reply: {r.developer_reply}</p>
                    ) : (
                      <div className="mt-2 flex gap-2">
                        <Input
                          value={replies[r.id] ?? ""}
                          maxLength={500}
                          placeholder="Reply to this review"
                          onChange={(e) => setReplies((p) => ({ ...p, [r.id]: e.target.value }))}
                        />
                        <Button size="sm" onClick={() => replyToReview.mutate(r.id)}>
                          Reply
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No reviews yet.</p>
            )}
          </div>

          <div className="surface-card space-y-3 p-4">
            <h2 className="font-display text-base font-semibold">Announcements</h2>
            <Input
              value={announceTitle}
              maxLength={120}
              placeholder="Announcement title"
              onChange={(e) => setAnnounceTitle(e.target.value)}
            />
            <Textarea
              rows={3}
              maxLength={800}
              value={announceBody}
              placeholder="Share update news with your users"
              onChange={(e) => setAnnounceBody(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => publishAnnouncement.mutate(false)}>
                Publish
              </Button>
              <Button size="sm" variant="outline" onClick={() => publishAnnouncement.mutate(true)}>
                Publish and pin
              </Button>
            </div>
            <ul className="space-y-2 text-sm">
              {announcementsQuery.data?.map((a) => (
                <li key={a.id} className="border-b border-border pb-2 last:border-0">
                  <p className="font-medium">
                    {a.title} {a.pinned && <Badge variant="secondary">Pinned</Badge>}
                  </p>
                  {a.body && <p className="text-muted-foreground">{a.body}</p>}
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="aso" className="space-y-3">
          <div className="surface-card p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold">Listing quality score</h2>
              <span className="font-display text-xl font-bold">{aso.score}/100</span>
            </div>
            <Progress value={aso.score} className="mt-3" />
            <ul className="mt-3 space-y-1 text-sm">
              {aso.checks.map((c) => (
                <li key={c.label} className={c.ok ? "text-muted-foreground" : "text-destructive"}>
                  {c.ok ? "Done" : "Missing"}: {c.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="surface-card space-y-3 p-4">
            <h2 className="font-display text-base font-semibold">AI publishing assistant</h2>
            <Select value={aiTask} onValueChange={(v) => setAiTask(v as (typeof AI_TASKS)[number])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_TASKS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {AI_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" disabled={runAi.isPending} onClick={() => runAi.mutate()}>
              {runAi.isPending ? "Working…" : "Run assistant"}
            </Button>
            {aiOutput && (
              <>
                <Textarea rows={10} value={aiOutput} onChange={(e) => setAiOutput(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setForm((f) => ({ ...f, description: aiOutput }))}>
                    Use as description
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        keywords: aiOutput
                          .split("\n")
                          .map((k) => k.trim())
                          .filter(Boolean)
                          .slice(0, 15),
                      }))
                    }
                  >
                    Use as keywords
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setReleaseNotes(aiOutput)}>
                    Use as release notes
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
