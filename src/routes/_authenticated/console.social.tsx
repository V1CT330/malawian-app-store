import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Check,
  Heart,
  Home,
  ImagePlus,
  Share2,
  Trash2,
  Menu,
  MessageCircle,
  Search,
  Send,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { ConsoleShell } from "@/components/console/ConsoleShell";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useProfile } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// New social tables are introduced by the additive migration
// 20261019140000_social_platform_core.sql. Keep generated Supabase types untouched
// until the migration is applied and types can be regenerated from the live schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const socialDb = supabase as any;

export const Route = createFileRoute("/_authenticated/console/social")({
  component: SocialPage,
});

const sections = [
  { id: "Feed", icon: Home, description: "Updates from people and communities." },
  { id: "Friends", icon: Users, description: "Friend requests and people on MAS." },
  { id: "Messages", icon: MessageCircle, description: "Private conversations with other MAS members." },
  { id: "Notifications", icon: Bell, description: "Your account and social activity." },
  { id: "Search", icon: Search, description: "Find members across MAS." },
] as const;

type SectionId = (typeof sections)[number]["id"];
type SocialProfile = {
  id: string;
  display_name: string | null;
  developer_name?: string | null;
  avatar_url: string | null;
  bio?: string | null;
  is_developer?: boolean;
};
type SocialPost = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  media_url: string | null;
  media_type: "image" | "video" | null;
};
type SocialConnection = {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
};
type SocialMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

function displayName(profile?: SocialProfile | null) {
  return profile?.developer_name || profile?.display_name || "MAS member";
}

function Avatar({ profile, size = "md" }: { profile?: SocialProfile | null; size?: "sm" | "md" }) {
  const label = displayName(profile);
  return profile?.avatar_url ? (
    <img
      src={profile.avatar_url}
      alt=""
      loading="lazy"
      className={cn("shrink-0 rounded-full object-cover", size === "sm" ? "h-8 w-8" : "h-10 w-10")}
    />
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-secondary-foreground",
        size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm",
      )}
    >
      {label.slice(0, 1).toUpperCase()}
    </span>
  );
}

function SocialPage() {
  const { userId, profile } = useProfile();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<SectionId>("Feed");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [postDraft, setPostDraft] = useState("");
  const [postMedia, setPostMedia] = useState<File | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");

  const active = sections.find((section) => section.id === activeSection) ?? sections[0];
  const ActiveIcon = active.icon;

  const profilesQuery = useQuery({
    queryKey: ["social", "profiles"],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await socialDb
        .from("public_profiles")
        .select("id, display_name, developer_name, avatar_url, bio, is_developer")
        .order("display_name", { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as SocialProfile[];
    },
  });

  const postsQuery = useQuery({
    queryKey: ["social", "posts"],
    enabled: Boolean(userId),
    refetchInterval: 45_000,
    queryFn: async () => {
      const { data, error } = await socialDb
        .from("social_posts")
        .select("id, author_id, body, created_at, media_url, media_type")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as SocialPost[];
    },
  });

  const connectionsQuery = useQuery({
    queryKey: ["social", "connections", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await socialDb
        .from("social_connections")
        .select("*")
        .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SocialConnection[];
    },
  });

  const reactionsQuery = useQuery({
    queryKey: ["social", "reactions", postsQuery.data?.map((post) => post.id).join(",")],
    enabled: Boolean(userId) && Boolean(postsQuery.data?.length),
    queryFn: async () => {
      const ids = (postsQuery.data ?? []).map((post) => post.id);
      const { data, error } = await socialDb.from("social_post_reactions").select("*").in("post_id", ids);
      if (error) throw error;
      return (data ?? []) as { id: string; post_id: string; user_id: string }[];
    },
  });

  const commentsQuery = useQuery({
    queryKey: ["social", "comments", postsQuery.data?.map((post) => post.id).join(",")],
    enabled: Boolean(userId) && Boolean(postsQuery.data?.length),
    queryFn: async () => {
      const ids = (postsQuery.data ?? []).map((post) => post.id);
      const { data, error } = await socialDb
        .from("social_post_comments")
        .select("id, post_id, author_id, body, created_at")
        .in("post_id", ids)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as { id: string; post_id: string; author_id: string; body: string; created_at: string }[];
    },
  });

  const messagesQuery = useQuery({
    queryKey: ["social", "messages", userId],
    enabled: Boolean(userId),
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await socialDb
        .from("social_messages")
        .select("*")
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order("created_at", { ascending: true })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as SocialMessage[];
    },
  });

  const notificationsQuery = useQuery({
    queryKey: ["social", "notifications", userId],
    enabled: Boolean(userId),
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const profileMap = useMemo(
    () => new Map((profilesQuery.data ?? []).map((item) => [item.id, item])),
    [profilesQuery.data],
  );
  const invalidateSocial = async (...keys: (string | undefined)[][]) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["social", "posts"] }),
      queryClient.invalidateQueries({ queryKey: ["social", "connections", userId] }),
      queryClient.invalidateQueries({ queryKey: ["social", "reactions"] }),
      queryClient.invalidateQueries({ queryKey: ["social", "comments"] }),
      queryClient.invalidateQueries({ queryKey: ["social", "messages", userId] }),
      ...keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    ]);
  };

  const createPost = useMutation({
    mutationFn: async ({ body, file }: { body: string; file: File | null }) => {
      let mediaUrl: string | null = null;
      let mediaType: "image" | "video" | null = null;
      let uploadedPath: string | null = null;
      if (file) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        uploadedPath = String(userId) + "/" + Date.now() + "-" + Math.random().toString(36).slice(2) + "." + ext;
        const { error: uploadError } = await supabase.storage.from("social-media").upload(uploadedPath, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        });
        if (uploadError) throw uploadError;
        mediaUrl = supabase.storage.from("social-media").getPublicUrl(uploadedPath).data.publicUrl;
        mediaType = file.type.startsWith("video/") ? "video" : "image";
      }
      const { error } = await socialDb.from("social_posts").insert({
        author_id: userId,
        body: body.trim(),
        media_url: mediaUrl,
        media_type: mediaType,
      });
      if (error) {
        if (uploadedPath) await supabase.storage.from("social-media").remove([uploadedPath]);
        throw error;
      }
    },
    onSuccess: async () => {
      setPostDraft("");
      setPostMedia(null);
      await invalidateSocial();
      toast.success("Post shared");
    },
    onError: (error: Error) => toast.error(error.message || "Could not publish your post"),
  });

  const deletePost = useMutation({
    mutationFn: async (postId: string) => {
      const post = (postsQuery.data ?? []).find((item) => item.id === postId);
      if (!post || post.author_id !== userId) throw new Error("You can only delete your own posts");
      const { error } = await socialDb.from("social_posts").delete().eq("id", postId).eq("author_id", userId);
      if (error) throw error;
      if (post.media_url) {
        const marker = "/object/public/social-media/";
        const markerIndex = post.media_url.indexOf(marker);
        const objectPath = markerIndex >= 0 ? decodeURIComponent(post.media_url.slice(markerIndex + marker.length)) : "";
        if (objectPath && objectPath.startsWith(String(userId) + "/")) {
          await supabase.storage.from("social-media").remove([objectPath]);
        }
      }
    },
    onSuccess: async () => {
      await invalidateSocial();
      toast.success("Post deleted");
    },
    onError: (error: Error) => toast.error(error.message || "Could not delete post"),
  });

  const toggleReaction = useMutation({
    mutationFn: async ({ postId, reacted }: { postId: string; reacted: boolean }) => {
      if (reacted) {
        const { error } = await socialDb
          .from("social_post_reactions")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await socialDb.from("social_post_reactions").insert({ post_id: postId, user_id: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => invalidateSocial(),
    onError: (error: Error) => toast.error(error.message || "Could not update reaction"),
  });

  const addComment = useMutation({
    mutationFn: async ({ postId, body }: { postId: string; body: string }) => {
      const { error } = await socialDb
        .from("social_post_comments")
        .insert({ post_id: postId, author_id: userId, body: body.trim() });
      if (error) throw error;
    },
    onSuccess: async (_result, variables) => {
      setCommentDrafts((current) => ({ ...current, [variables.postId]: "" }));
      await queryClient.invalidateQueries({ queryKey: ["social", "comments"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not add comment"),
  });

  const sendConnection = useMutation({
    mutationFn: async (recipientId: string) => {
      const existing = relationshipMap.get(recipientId);
      if (existing?.status === "declined") {
        const { error: deleteError } = await socialDb.from("social_connections").delete().eq("id", existing.id);
        if (deleteError) throw deleteError;
      }
      const { error } = await socialDb
        .from("social_connections")
        .insert({ requester_id: userId, recipient_id: recipientId, status: "pending" });
      if (error) throw error;
    },
    onSuccess: () => invalidateSocial(),
    onError: (error: Error) => toast.error(error.message.includes("duplicate") ? "A connection request already exists" : error.message),
  });

  const respondConnection = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "accepted" | "declined" }) => {
      const { error } = await socialDb.from("social_connections").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateSocial(),
    onError: (error: Error) => toast.error(error.message || "Could not update request"),
  });

  const sendMessage = useMutation({
    mutationFn: async ({ recipientId, body }: { recipientId: string; body: string }) => {
      const { error } = await socialDb
        .from("social_messages")
        .insert({ sender_id: userId, recipient_id: recipientId, body: body.trim() });
      if (error) throw error;
    },
    onSuccess: async () => {
      setMessageDraft("");
      await queryClient.invalidateQueries({ queryKey: ["social", "messages", userId] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not send message"),
  });

  const markNotificationRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id).eq("user_id", userId!);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["social", "notifications", userId] }),
    onError: (error: Error) => toast.error(error.message || "Could not mark notification as read"),
  });

  const connections = connectionsQuery.data ?? [];
  const incoming = connections.filter((item) => item.recipient_id === userId && item.status === "pending");
  const acceptedIds = new Set(
    connections
      .filter((item) => item.status === "accepted")
      .map((item) => item.requester_id === userId ? item.recipient_id : item.requester_id),
  );
  const relationshipMap = new Map<string, SocialConnection>();
  connections.forEach((item) => {
    const otherId = item.requester_id === userId ? item.recipient_id : item.requester_id;
    // Results are newest-first; preserve the latest relationship for each member.
    if (!relationshipMap.has(otherId)) relationshipMap.set(otherId, item);
  });
  const filteredProfiles = (profilesQuery.data ?? []).filter((item) =>
    item.id !== userId &&
    `${displayName(item)} ${item.bio ?? ""}`.toLowerCase().includes(searchTerm.trim().toLowerCase()),
  );
  const selectedProfile = selectedRecipient ? profileMap.get(selectedRecipient) : null;
  const threadMessages = (messagesQuery.data ?? []).filter((item) =>
    selectedRecipient && (
      (item.sender_id === userId && item.recipient_id === selectedRecipient) ||
      (item.sender_id === selectedRecipient && item.recipient_id === userId)
    ),
  );
  const unreadNotifications = (notificationsQuery.data ?? []).filter((item) => !item.read).length;

  useEffect(() => {
    if (!userId || !selectedRecipient) return;
    const unreadIds = (messagesQuery.data ?? [])
      .filter((message) => message.sender_id === selectedRecipient && message.recipient_id === userId && !message.read_at)
      .map((message) => message.id);
    if (!unreadIds.length) return;
    socialDb
      .from("social_messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds)
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) {
          toast.error("Could not mark messages as read");
          return;
        }
        void queryClient.invalidateQueries({ queryKey: ["social", "messages", userId] });
      });
  }, [messagesQuery.data, queryClient, selectedRecipient, userId]);

  function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = postDraft.trim();
    if (!body) return;
    if (body.length > 2000) {
      toast.error("Posts must be 2,000 characters or fewer");
      return;
    }
    if (postMedia) {
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm", "video/quicktime"];
      if (!allowedTypes.includes(postMedia.type)) {
        toast.error("Choose a JPG, PNG, WEBP, GIF, MP4, WEBM, or MOV file");
        return;
      }
      if (postMedia.size > 50 * 1024 * 1024) {
        toast.error("Media files must be 50 MB or smaller");
        return;
      }
    }
    createPost.mutate({ body, file: postMedia });
  }

  function submitComment(event: FormEvent<HTMLFormElement>, postId: string) {
    event.preventDefault();
    const body = (commentDrafts[postId] ?? "").trim();
    if (!body) return;
    if (body.length > 1000) {
      toast.error("Comments must be 1,000 characters or fewer");
      return;
    }
    addComment.mutate({ postId, body });
  }

  function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = messageDraft.trim();
    if (!selectedRecipient || !body) return;
    if (body.length > 4000) {
      toast.error("Messages must be 4,000 characters or fewer");
      return;
    }
    sendMessage.mutate({ recipientId: selectedRecipient, body });
  }

  function renderPeople() {
    if (profilesQuery.isLoading) return <p className="px-4 py-6 text-sm text-muted-foreground">Loading members…</p>;
    if (profilesQuery.isError) return <p role="alert" className="px-4 py-6 text-sm text-destructive">Could not load members. Refresh to try again.</p>;
    if (!filteredProfiles.length) return <p className="px-4 py-6 text-sm text-muted-foreground">No members match that search.</p>;
    return filteredProfiles.map((person) => {
      const relationship = relationshipMap.get(person.id);
      const isFriend = acceptedIds.has(person.id);
      return (
        <article key={person.id} className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Avatar profile={person} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{displayName(person)}</p>
            <p className="truncate text-xs text-muted-foreground">{person.bio || (person.is_developer ? "MAS developer" : "MAS member")}</p>
          </div>
          {isFriend ? (
            <button type="button" onClick={() => { setSelectedRecipient(person.id); setActiveSection("Messages"); }} className="flex items-center gap-1 border border-border px-3 py-2 text-xs font-medium hover:bg-secondary">
              <MessageCircle className="h-4 w-4" /> Message
            </button>
          ) : relationship?.status === "pending" && relationship.requester_id === userId ? (
            <span className="px-2 py-2 text-xs text-muted-foreground">Requested</span>
          ) : relationship?.status === "pending" && relationship.recipient_id === userId ? (
            <button type="button" onClick={() => respondConnection.mutate({ id: relationship.id, status: "accepted" })} className="flex items-center gap-1 border border-border px-3 py-2 text-xs font-medium hover:bg-secondary">
              <Check className="h-4 w-4" /> Accept
            </button>
          ) : (
            <button type="button" disabled={sendConnection.isPending} onClick={() => sendConnection.mutate(person.id)} className="flex items-center gap-1 border border-border px-3 py-2 text-xs font-medium hover:bg-secondary disabled:opacity-50">
              <UserPlus className="h-4 w-4" /> Add
            </button>
          )}
        </article>
      );
    });
  }

  return (
    <ConsoleShell title="Social" hideTopBar hideTitleCard>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-[260px] bg-sidebar p-3">
          <SheetTitle className="mb-4 px-2 font-semibold">MAS menu</SheetTitle>
          <nav aria-label="Site menu" className="space-y-1">
            {[
              { label: "Home", to: "/" },
              { label: "App Store", to: "/store" },
              { label: "Developer Dashboard", to: "/console" },
              { label: "Social", to: "/console/social" },
              { label: "My Profile", to: "/console/settings" },
            ].map((item) => (
              <Link key={item.to} to={item.to} onClick={() => setSidebarOpen(false)} className="block border-b border-border px-3 py-3 text-sm text-foreground transition-colors hover:bg-secondary">
                {item.label}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      <section className="border-y border-border bg-background">
        <h1 className="px-4 py-3 text-xl font-semibold sm:px-5">Social</h1>
        <nav aria-label="Social menu" className="flex w-full items-stretch justify-evenly border-b border-border px-1 sm:px-3">
          {sections.map(({ id, icon: Icon }) => {
            const selected = activeSection === id;
            if (id !== "Search") {
              return (
                <button key={id} type="button" onClick={() => setActiveSection(id)} aria-label={id} title={id} aria-current={selected ? "page" : undefined}
                  className={cn("flex min-w-0 flex-1 items-center justify-center border-b-2 px-2 py-3 transition-colors duration-200 sm:px-5", selected ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground")}>
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  {id === "Notifications" && unreadNotifications > 0 && <span className="ml-1 text-[10px] font-semibold">{unreadNotifications > 9 ? "9+" : unreadNotifications}</span>}
                </button>
              );
            }
            return (
              <div key={id} className="flex min-w-0 flex-1 flex-col items-stretch">
                <button type="button" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar menu" title="Sidebar menu" className="flex items-center justify-center px-2 py-2 text-muted-foreground transition-colors hover:text-foreground">
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => setActiveSection("Search")} aria-label="Search" title="Search" aria-current={selected ? "page" : undefined}
                  className={cn("flex items-center justify-center border-b-2 px-2 py-3 transition-colors duration-200 sm:px-5", selected ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground")}>
                  <Search className="h-5 w-5 shrink-0" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </nav>

        <main className="min-h-[220px] min-w-0">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3 sm:px-5">
            <ActiveIcon className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2 className="text-base font-semibold">{activeSection}</h2>
          </div>

          {!userId ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">Sign in to use Social.</div>
          ) : activeSection === "Feed" ? (
            <div className="mx-auto max-w-2xl">
              <form onSubmit={submitPost} className="border-b border-border p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <Avatar profile={profile as SocialProfile | null} />
                  <div className="min-w-0 flex-1">
                    <label htmlFor="social-post" className="sr-only">Write a post</label>
                    <textarea id="social-post" value={postDraft} onChange={(event) => setPostDraft(event.target.value)} maxLength={2000} rows={3} placeholder="What would you like to share?" className="w-full resize-y border border-border bg-background p-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary" />
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-wrap items-center gap-3">
                        <label className="flex cursor-pointer items-center gap-2 border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary">
                          <ImagePlus className="h-4 w-4" /> Add photo/video
                          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" className="sr-only" onChange={(event) => setPostMedia(event.target.files?.[0] ?? null)} />
                        </label>
                        {postMedia && <span className="max-w-[170px] truncate text-xs text-muted-foreground">{postMedia.name}<button type="button" onClick={() => setPostMedia(null)} className="ml-2 underline">Remove</button></span>}
                        <span className="text-xs text-muted-foreground">{postDraft.length}/2000</span>
                      </div>
                      <button type="submit" disabled={!postDraft.trim() || createPost.isPending} className="flex items-center gap-2 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
                        <Send className="h-4 w-4" /> {createPost.isPending ? "Posting…" : "Post"}
                      </button>
                    </div>
                  </div>
                </div>
              </form>

              {postsQuery.isLoading ? <p className="px-4 py-8 text-sm text-muted-foreground">Loading feed…</p> : postsQuery.isError ? (
                <p role="alert" className="px-4 py-8 text-sm text-destructive">The feed could not load. The social database migration may not have been applied yet.</p>
              ) : !postsQuery.data?.length ? (
                <div className="px-4 py-10 text-center">
                  <Home className="mx-auto h-7 w-7 text-muted-foreground" />
                  <p className="mt-3 text-sm font-semibold">Your community starts here</p>
                  <p className="mt-1 text-sm text-muted-foreground">Share the first update with MAS members.</p>
                </div>
              ) : postsQuery.data.map((post) => {
                const author = profileMap.get(post.author_id) ?? (post.author_id === userId ? profile as SocialProfile : null);
                const postReactions = (reactionsQuery.data ?? []).filter((reaction) => reaction.post_id === post.id);
                const reacted = postReactions.some((reaction) => reaction.user_id === userId);
                const postComments = (commentsQuery.data ?? []).filter((comment) => comment.post_id === post.id);
                return (
                  <article key={post.id} className="border-b border-border px-4 py-4 sm:px-5">
                    <div className="flex items-start gap-3">
                      <Avatar profile={author} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{displayName(author)}</p>
                        <time className="text-xs text-muted-foreground" dateTime={post.created_at}>{new Date(post.created_at).toLocaleString()}</time>
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap break-words py-4 text-sm leading-6">{post.body}</p>
                    {post.media_url && post.media_type === "image" && <img src={post.media_url} alt="Post attachment" loading="lazy" className="mb-4 max-h-[560px] w-full border border-border object-contain" />}
                    {post.media_url && post.media_type === "video" && <video src={post.media_url} controls preload="metadata" className="mb-4 max-h-[560px] w-full border border-border bg-black" aria-label="Post video attachment" />}
                    <div className="flex items-center gap-4 border-y border-border py-2 text-xs text-muted-foreground">
                      <button type="button" disabled={toggleReaction.isPending} onClick={() => toggleReaction.mutate({ postId: post.id, reacted })} className={cn("flex items-center gap-1.5 px-1 py-1 transition-colors hover:text-foreground", reacted && "text-destructive")} aria-pressed={reacted}>
                        <Heart className={cn("h-4 w-4", reacted && "fill-current")} /> {postReactions.length} {postReactions.length === 1 ? "like" : "likes"}
                      </button>
                      <span className="flex items-center gap-1.5"><MessageCircle className="h-4 w-4" /> {postComments.length} comments</span>
                      <button type="button" onClick={() => {
                        const shareText = post.body + "\n\n" + window.location.origin + "/console/social";
                        if (navigator.share) {
                          void navigator.share({ title: "MAS post by " + displayName(author), text: post.body, url: window.location.origin + "/console/social" }).catch(() => undefined);
                        } else {
                          void navigator.clipboard.writeText(shareText).then(() => toast.success("Post copied for sharing")).catch(() => toast.error("Could not copy post"));
                        }
                      }} className="ml-auto flex items-center gap-1.5 px-1 py-1 hover:text-foreground"><Share2 className="h-4 w-4" /> Share</button>
                      {post.author_id === userId && <button type="button" disabled={deletePost.isPending} onClick={() => {
                        if (window.confirm("Delete this post? This cannot be undone.")) deletePost.mutate(post.id);
                      }} aria-label="Delete your post" title="Delete post" className="flex items-center gap-1.5 px-1 py-1 text-muted-foreground hover:text-destructive disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>}
                    </div>
                    {postComments.slice(-5).map((comment) => {
                      const commentAuthor = profileMap.get(comment.author_id) ?? (comment.author_id === userId ? profile as SocialProfile : null);
                      return <div key={comment.id} className="flex items-start gap-2 pt-3"><Avatar profile={commentAuthor} size="sm" /><div className="min-w-0 flex-1 bg-muted/50 px-3 py-2"><p className="text-xs font-semibold">{displayName(commentAuthor)}</p><p className="whitespace-pre-wrap break-words text-sm">{comment.body}</p></div></div>;
                    })}
                    <form onSubmit={(event) => submitComment(event, post.id)} className="mt-3 flex items-center gap-2">
                      <label className="sr-only" htmlFor={`comment-${post.id}`}>Write a comment</label>
                      <input id={`comment-${post.id}`} value={commentDrafts[post.id] ?? ""} onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))} maxLength={1000} placeholder="Write a comment…" className="min-w-0 flex-1 border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
                      <button type="submit" disabled={!(commentDrafts[post.id] ?? "").trim() || addComment.isPending} aria-label="Send comment" className="border border-border p-2 hover:bg-secondary disabled:opacity-50"><Send className="h-4 w-4" /></button>
                    </form>
                  </article>
                );
              })}
            </div>
          ) : activeSection === "Friends" ? (
            <div className="mx-auto max-w-2xl">
              {incoming.length > 0 && <section className="border-b border-border">
                <h3 className="px-4 pt-4 text-sm font-semibold">Friend requests ({incoming.length})</h3>
                {incoming.map((request) => {
                  const person = profileMap.get(request.requester_id);
                  return <div key={request.id} className="flex items-center gap-3 px-4 py-3"><Avatar profile={person} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{displayName(person)}</p><p className="text-xs text-muted-foreground">Wants to connect with you</p></div><button type="button" onClick={() => respondConnection.mutate({ id: request.id, status: "accepted" })} className="border border-border p-2 hover:bg-secondary" aria-label="Accept friend request"><Check className="h-4 w-4" /></button><button type="button" onClick={() => respondConnection.mutate({ id: request.id, status: "declined" })} className="border border-border p-2 hover:bg-secondary" aria-label="Decline friend request"><X className="h-4 w-4" /></button></div>;
                })}
              </section>}
              <div className="p-4"><label htmlFor="friends-search" className="sr-only">Search members</label><input id="friends-search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Find people on MAS…" className="w-full border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" /></div>
              {renderPeople()}
            </div>
          ) : activeSection === "Search" ? (
            <div className="mx-auto max-w-2xl">
              <div className="p-4"><label htmlFor="social-search" className="sr-only">Search people</label><div className="flex items-center gap-2 border border-border px-3"><Search className="h-4 w-4 text-muted-foreground" /><input id="social-search" autoFocus value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search people by name or bio…" className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" /></div></div>
              {renderPeople()}
            </div>
          ) : activeSection === "Messages" ? (
            <div className="mx-auto grid max-w-4xl grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]">
              <aside className="border-b border-border md:border-b-0 md:border-r">
                <div className="p-3"><label htmlFor="message-contact-search" className="sr-only">Find a conversation</label><input id="message-contact-search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Find people…" className="w-full border border-border bg-background px-2 py-2 text-sm outline-none focus:border-primary" /></div>
                {(profilesQuery.data ?? []).filter((person) => person.id !== userId && (acceptedIds.has(person.id) || (messagesQuery.data ?? []).some((message) => message.sender_id === person.id || message.recipient_id === person.id))).filter((person) => displayName(person).toLowerCase().includes(searchTerm.toLowerCase())).map((person) => {
                  const last = [...(messagesQuery.data ?? [])].reverse().find((message) => message.sender_id === person.id || message.recipient_id === person.id);
                  return <button key={person.id} type="button" onClick={() => setSelectedRecipient(person.id)} className={cn("flex w-full items-center gap-2 border-t border-border px-3 py-3 text-left hover:bg-secondary", selectedRecipient === person.id && "bg-secondary")}><Avatar profile={person} size="sm" /><span className="min-w-0 flex-1 truncate text-sm">{displayName(person)}{last?.sender_id === person.id && last.recipient_id === userId && !last.read_at ? <span className="block text-xs font-semibold text-primary">New message</span> : null}</span></button>;
                })}
                <div className="border-t border-border p-3"><p className="mb-2 text-xs text-muted-foreground">Start a conversation</p><button type="button" onClick={() => setActiveSection("Search")} className="flex items-center gap-2 text-sm font-medium text-primary"><Search className="h-4 w-4" /> Find a member</button></div>
              </aside>
              <section className="flex min-h-[360px] min-w-0 flex-col">
                {selectedRecipient && selectedProfile ? <>
                  <header className="flex items-center gap-3 border-b border-border px-4 py-3"><Avatar profile={selectedProfile} size="sm" /><div><p className="text-sm font-semibold">{displayName(selectedProfile)}</p><p className="text-xs text-muted-foreground">Private conversation</p></div></header>
                  <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                    {threadMessages.length ? threadMessages.map((message) => <div key={message.id} className={cn("flex", message.sender_id === userId ? "justify-end" : "justify-start")}><div className={cn("max-w-[85%] whitespace-pre-wrap break-words px-3 py-2 text-sm", message.sender_id === userId ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}>{message.body}<time className="mt-1 block text-[10px] opacity-70">{new Date(message.created_at).toLocaleString()}</time></div></div>) : <p className="py-8 text-center text-sm text-muted-foreground">Say hello to start this conversation.</p>}
                  </div>
                  <form onSubmit={submitMessage} className="flex gap-2 border-t border-border p-3"><label htmlFor="social-message" className="sr-only">Message</label><input id="social-message" value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} maxLength={4000} placeholder="Write a message…" className="min-w-0 flex-1 border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" /><button type="submit" disabled={!messageDraft.trim() || sendMessage.isPending} aria-label="Send message" className="bg-primary p-2 text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4" /></button></form>
                </> : <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center"><MessageCircle className="h-8 w-8 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">Your messages</p><p className="mt-1 max-w-xs text-sm text-muted-foreground">Choose a conversation or find a member to send a message.</p><button type="button" onClick={() => setActiveSection("Search")} className="mt-4 border border-border px-4 py-2 text-sm font-medium hover:bg-secondary">Find members</button></div>}
              </section>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl">
              {notificationsQuery.isLoading ? <p className="px-4 py-8 text-sm text-muted-foreground">Loading notifications…</p> : notificationsQuery.isError ? <p role="alert" className="px-4 py-8 text-sm text-destructive">Could not load notifications.</p> : !(notificationsQuery.data ?? []).length ? <div className="px-4 py-10 text-center"><Bell className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">You’re all caught up</p><p className="mt-1 text-sm text-muted-foreground">New account and activity notifications will appear here.</p></div> : (notificationsQuery.data ?? []).map((notification) => <article key={notification.id} className={cn("flex items-start gap-3 border-b border-border px-4 py-4", !notification.read && "bg-secondary/40")}><Bell className="mt-1 h-4 w-4 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{notification.title}</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{notification.body}</p><time className="mt-2 block text-xs text-muted-foreground" dateTime={notification.created_at}>{new Date(notification.created_at).toLocaleString()}</time></div>{!notification.read && <button type="button" onClick={() => markNotificationRead.mutate(notification.id)} aria-label="Mark notification as read" className="border border-border p-2 hover:bg-background"><Check className="h-4 w-4" /></button>}</article>)}
            </div>
          )}
        </main>
      </section>
    </ConsoleShell>
  );
}
