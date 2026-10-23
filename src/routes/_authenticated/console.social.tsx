import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  ArrowLeft,
  BadgeCheck,
  Check,
  ExternalLink,
  Globe,
  Heart,
  Home,
  ImagePlus,
  Share2,
  Trash2,
  Wallet,
  Megaphone,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Package,
  Plus,
  Search,
  Send,
  UserCircle,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { ConsoleShell } from "@/components/console/ConsoleShell";
import { DemoPreview } from "@/components/DemoPreview";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useProfile, useSignedUrl, useUnreadCount } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { SocialNotificationsPanel } from "@/components/console/SocialNotificationsPanel";
import { InvestGrowPanel } from "@/components/console/InvestGrowPanel";

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
  { id: "Notifications", icon: Bell, description: "Your social activity and connection updates." },
  { id: "Search", icon: Search, description: "Find members across MAS." },
] as const;

type SectionId = (typeof sections)[number]["id"] | "Find Investors" | "Monetization";
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
  const signedAvatar = useSignedUrl(profile?.avatar_url);
  const avatarSrc = signedAvatar ?? (profile?.avatar_url?.startsWith("https://") ? profile.avatar_url : null);
  return avatarSrc ? (
    <img
      src={avatarSrc}
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
  const ownAvatar = useSignedUrl(profile?.avatar_url);
  const unread = useUnreadCount();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<SectionId>("Feed");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [postDraft, setPostDraft] = useState("");
  const [postMedia, setPostMedia] = useState<File | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentDraft, setEditingCommentDraft] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [projectType, setProjectType] = useState<"app" | "website" | "game" | "tool" | "other">("website");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectImageUrl, setProjectImageUrl] = useState("");

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

  const myListingsQuery = useQuery({
    queryKey: ["social", "my-published-listings", userId],
    enabled: Boolean(userId && profile?.is_developer),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id,slug,name,tagline,kind,icon_url,downloads,rating_avg,rating_count")
        .eq("developer_id", userId!)
        .eq("status", "published")
        .order("updated_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data ?? [];
    },
  });

  const externalProjectsQuery = useQuery({
    queryKey: ["developer-portfolio-projects", userId],
    enabled: Boolean(userId && profile?.is_developer),
    queryFn: async () => {
      const { data, error } = await socialDb
        .from("developer_portfolio_projects")
        .select("id,developer_id,title,description,project_type,url,image_url,created_at")
        .eq("developer_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as {
        id: string; developer_id: string; title: string; description: string | null;
        project_type: "app" | "website" | "game" | "tool" | "other";
        url: string; image_url: string | null; created_at: string;
      }[];
    },
  });

  const myPostsQuery = useQuery({
    queryKey: ["social", "my-posts", userId],
    enabled: Boolean(userId),
    refetchInterval: 45_000,
    queryFn: async () => {
      const { data, error, count } = await socialDb
        .from("social_posts")
        .select("id, author_id, body, created_at, media_url, media_type", { count: "exact" })
        .eq("author_id", userId!)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return { posts: (data ?? []) as SocialPost[], count: count ?? 0 };
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



  const profileMap = useMemo(
    () => new Map((profilesQuery.data ?? []).map((item) => [item.id, item])),
    [profilesQuery.data],
  );
  const reactionsByPost = useMemo(() => {
    const grouped = new Map<string, { id: string; post_id: string; user_id: string }[]>();
    for (const reaction of reactionsQuery.data ?? []) {
      const group = grouped.get(reaction.post_id);
      if (group) group.push(reaction);
      else grouped.set(reaction.post_id, [reaction]);
    }
    return grouped;
  }, [reactionsQuery.data]);
  const commentsByPost = useMemo(() => {
    const grouped = new Map<string, { id: string; post_id: string; author_id: string; body: string; created_at: string }[]>();
    for (const comment of commentsQuery.data ?? []) {
      const group = grouped.get(comment.post_id);
      if (group) group.push(comment);
      else grouped.set(comment.post_id, [comment]);
    }
    return grouped;
  }, [commentsQuery.data]);
  const invalidateSocial = async (...queryKeys: (string | undefined)[][]) => {
    await Promise.all(
      queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
  };

  const addExternalProject = useMutation({
    mutationFn: async () => {
      const title = projectTitle.trim();
      if (!title) throw new Error("Enter a project name");
      if (title.length > 100) throw new Error("Project names must be 100 characters or fewer");
      if (projectDescription.trim().length > 500) throw new Error("Descriptions must be 500 characters or fewer");
      const validateUrl = (value: string, label: string) => {
        if (!value.trim()) return null;
        let parsed: URL;
        try { parsed = new URL(value.trim()); } catch { throw new Error(label + " must be a valid HTTPS URL"); }
        if (parsed.protocol !== "https:") throw new Error(label + " must use HTTPS");
        return parsed.toString();
      };
      const safeUrl = validateUrl(projectUrl, "Project link");
      if (!safeUrl) throw new Error("Enter the project's public URL");
      const safeImageUrl = validateUrl(projectImageUrl, "Image link");
      const { error } = await socialDb.from("developer_portfolio_projects").insert({
        developer_id: userId, title, description: projectDescription.trim() || null,
        project_type: projectType, url: safeUrl, image_url: safeImageUrl,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setProjectTitle(""); setProjectUrl(""); setProjectType("website");
      setProjectDescription(""); setProjectImageUrl("");
      await queryClient.invalidateQueries({ queryKey: ["developer-portfolio-projects", userId] });
      toast.success("Project added to your portfolio");
    },
    onError: (error: Error) => toast.error(error.message || "Could not add project"),
  });

  const removeExternalProject = useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await socialDb.from("developer_portfolio_projects")
        .delete().eq("id", projectId).eq("developer_id", userId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["developer-portfolio-projects", userId] });
      toast.success("Project removed from your portfolio");
    },
    onError: (error: Error) => toast.error(error.message || "Could not remove project"),
  });

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
      await invalidateSocial(["social", "posts"], ["social", "reactions"], ["social", "comments"]);
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
      await invalidateSocial(["social", "posts"], ["social", "reactions"], ["social", "comments"]);
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
    onSuccess: () => invalidateSocial(["social", "reactions"]),
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

  const editComment = useMutation({
    mutationFn: async ({ commentId, body }: { commentId: string; body: string }) => {
      const nextBody = body.trim();
      if (!nextBody) throw new Error("A comment cannot be empty");
      if (nextBody.length > 1000) throw new Error("Comments must be 1,000 characters or fewer");
      const comment = (commentsQuery.data ?? []).find((item) => item.id === commentId);
      if (!comment || comment.author_id !== userId) throw new Error("You can only edit your own comments");
      const { data, error } = await socialDb
        .from("social_post_comments")
        .update({ body: nextBody })
        .eq("id", commentId)
        .eq("author_id", userId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Comment was not updated. Refresh and try again.");
    },
    onSuccess: async () => {
      setEditingCommentId(null);
      setEditingCommentDraft("");
      await queryClient.invalidateQueries({ queryKey: ["social", "comments"] });
      toast.success("Comment updated");
    },
    onError: (error: Error) => toast.error(error.message || "Could not edit comment"),
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      const comment = (commentsQuery.data ?? []).find((item) => item.id === commentId);
      if (!comment || comment.author_id !== userId) throw new Error("You can only delete your own comments");
      const { data, error } = await socialDb
        .from("social_post_comments")
        .delete()
        .eq("id", commentId)
        .eq("author_id", userId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Comment was not deleted. Refresh and try again.");
    },
    onSuccess: async () => {
      if (editingCommentId) {
        setEditingCommentId(null);
        setEditingCommentDraft("");
      }
      await queryClient.invalidateQueries({ queryKey: ["social", "comments"] });
      toast.success("Comment deleted");
    },
    onError: (error: Error) => toast.error(error.message || "Could not delete comment"),
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
    onSuccess: () => invalidateSocial(["social", "connections", userId]),
    onError: (error: Error) => toast.error(error.message.includes("duplicate") ? "A connection request already exists" : error.message),
  });

  const respondConnection = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "accepted" | "declined" }) => {
      const { error } = await socialDb.from("social_connections").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateSocial(["social", "connections", userId]),
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
    <ConsoleShell title="Social" hideTopBar hideTitleCard fullWidth>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-[260px] bg-sidebar p-3">
          <SheetTitle className="mb-4 px-2 font-semibold">MAS menu</SheetTitle>
          <nav aria-label="Site menu" className="space-y-1">
            {[
              { label: "Home", to: "/" },
              { label: "App Store", to: "/store" },
              { label: "Developer Dashboard", to: "/console" },
              { label: "Social", to: "/console/social" },
            ].map((item) => (
              <Link key={item.to} to={item.to} onClick={() => setSidebarOpen(false)} className="block border-b border-border px-3 py-3 text-sm text-foreground transition-colors hover:bg-secondary">
                {item.label}
              </Link>
            ))}
            <div className="pt-2">
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Opportunities</p>
              {["Collabo", "Find Investors", "Grants", "Crowdfund"].map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setSidebarOpen(false);
                    if (label === "Find Investors") setActiveSection("Find Investors");
                    else toast.info(`${label} opportunities are not yet available.`);
                  }}
                  className="block w-full border-b border-border px-3 py-3 text-left text-sm text-foreground transition-colors hover:bg-secondary"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="pt-2">
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Creator tools</p>
              <button
                type="button"
                onClick={() => {
                  setSidebarOpen(false);
                  setActiveSection("Monetization");
                }}
                className="block w-full border-b border-border px-3 py-3 text-left text-sm text-foreground transition-colors hover:bg-secondary"
              >
                Monetise
              </button>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setSidebarOpen(false);
                  setActiveSection("My Profile");
                }}
                className="block w-full border-b border-border px-3 py-3 text-left text-sm text-foreground transition-colors hover:bg-secondary"
              >
                My Profile
              </button>
            </div>
          </nav>
        </SheetContent>
      </Sheet>

      <section className="min-h-[calc(100vh-4rem)] w-full min-w-0 max-w-full overflow-x-clip border-b border-border/70 bg-muted/30">
        <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-background px-4 py-3.5 sm:px-6">
          <div>
             <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Social</h1>
             <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">Connect, share, and discover the MAS community.</p>
           </div>
          <button type="button" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar menu" title="Sidebar menu" className="flex h-9 w-9 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Social menu" className="sticky top-0 z-20 flex w-full min-w-0 items-stretch justify-start overflow-x-auto border-b border-border bg-background/95 px-1 shadow-sm backdrop-blur sm:justify-evenly sm:px-3">
          {sections.map(({ id, icon: Icon }) => {
            const selected = activeSection === id;
            return (
              <button key={id} type="button" onClick={() => setActiveSection(id)} aria-label={id} title={id} aria-current={selected ? "page" : undefined}
                className={cn("flex min-h-14 min-w-[76px] shrink-0 flex-col items-center justify-center gap-1 border-b-2 px-2 py-2.5 transition-colors duration-200 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:min-w-0 sm:flex-1 sm:flex-row sm:gap-2 sm:px-3 sm:py-3 lg:px-5", selected ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground")}>
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="max-w-full truncate text-[10px] leading-none sm:text-xs">{id}</span>
                {id === "Notifications" && unread > 0 && <span className="ml-1 text-[10px] font-semibold">{unread > 9 ? "9+" : unread}</span>}
              </button>
            );
          })}
        </nav>

        {userId && !profilesQuery.isLoading && !(profilesQuery.data ?? []).some((person) => person.id !== userId) && activeSection === "Friends" && <DemoPreview title="Friends · sample view" description="Example member cards to preview a populated community." items={[{ title: "Tadala Phiri", detail: "Frontend developer · Blantyre", metric: "Interested in web apps", status: "Sample member" }, { title: "Chisomo Banda", detail: "Product designer · Lilongwe", metric: "Building education tools", status: "Sample member" }, { title: "Thoko Mbewe", detail: "Student developer · Zomba", metric: "Interested in beta testing", status: "Sample member" }]} />}
        {userId && !profilesQuery.isLoading && !(profilesQuery.data ?? []).some((person) => person.id !== userId) && activeSection === "Search" && <DemoPreview title="Member search · sample view" description="Example results showing how member search can look." items={[{ title: "Tadala Phiri", detail: "Frontend developer · React and TypeScript", status: "Sample profile" }, { title: "Chisomo Banda", detail: "UI/UX designer · Education products", status: "Sample profile" }]} />}
        {userId && !profilesQuery.isLoading && !(profilesQuery.data ?? []).some((person) => person.id !== userId) && activeSection === "Messages" && <DemoPreview title="Messages · sample view" description="Illustrative conversations only. These messages are not sent and cannot be replied to." items={[{ title: "Tadala Phiri", detail: "“I’d be happy to test your next release.”", metric: "Yesterday · sample conversation", status: "Demo" }, { title: "Chisomo Banda", detail: "“I have a few ideas for the app listing design.”", metric: "Monday · sample conversation", status: "Demo" }]} />}
        <main className="min-h-[220px] w-full min-w-0 max-w-full overflow-x-clip">
          {!userId ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">Sign in to use Social.</div>
          ) : activeSection === "Feed" ? (
            <div className="w-full space-y-1 pb-6 pt-0">
              <form onSubmit={submitPost} className="w-full border-y border-border/80 bg-background px-4 py-3 sm:px-5">
                <div className="flex items-start gap-3">
                  <Avatar profile={profile as SocialProfile | null} />
                  <div className="min-w-0 flex-1">
                    <label htmlFor="social-post" className="sr-only">Write a post</label>
                    <textarea id="social-post" value={postDraft} onChange={(event) => setPostDraft(event.target.value)} maxLength={2000} rows={3} placeholder="What would you like to share?" className="min-h-24 w-full resize-y rounded-2xl border border-border/70 bg-muted/30 p-3.5 text-sm leading-6 outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/10" />
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-wrap items-center gap-3">
                        <label className="flex cursor-pointer items-center gap-2 border border-border/80 px-3 py-2 text-xs font-medium transition-colors hover:bg-muted focus-within:ring-2 focus-within:ring-ring">
                          <ImagePlus className="h-4 w-4" /> Add photo/video
                          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" className="sr-only" onChange={(event) => setPostMedia(event.target.files?.[0] ?? null)} />
                        </label>
                        {postMedia && <span className="max-w-[170px] truncate text-xs text-muted-foreground">{postMedia.name}<button type="button" onClick={() => setPostMedia(null)} className="ml-2 underline">Remove</button></span>}
                        <span className="text-xs text-muted-foreground">{postDraft.length}/2000</span>
                      </div>
                      <button type="submit" disabled={!postDraft.trim() || createPost.isPending} className="flex items-center gap-2 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
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
                const postReactions = reactionsByPost.get(post.id) ?? [];
                const reacted = postReactions.some((reaction) => reaction.user_id === userId);
                const postComments = commentsByPost.get(post.id) ?? [];
                return (
                  <article key={post.id} className="relative w-full min-w-0 overflow-x-clip border-y border-border/80 bg-background px-4 py-4 shadow-sm sm:px-5">
                    <div className="flex items-start gap-3">
                      <Avatar profile={author} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{displayName(author)}</p>
                        <time className="mt-0.5 block text-xs text-muted-foreground" dateTime={post.created_at}>{new Date(post.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time>
                      </div>
                      {post.author_id === userId && <details className="relative">
                        <summary aria-label="Post options" title="Post options" className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden">
                          <MoreHorizontal className="h-5 w-5" />
                        </summary>
                        <div className="absolute right-0 top-full z-20 mt-1 min-w-36 rounded-lg border border-border bg-background p-1 shadow-lg">
                          <button type="button" disabled={deletePost.isPending} onClick={(event) => {
                            const menu = event.currentTarget.closest("details");
                            if (window.confirm("Delete this post? This cannot be undone.")) {
                              menu?.removeAttribute("open");
                              deletePost.mutate(post.id);
                            }
                          }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-muted disabled:opacity-50">
                            <Trash2 className="h-4 w-4" /> Delete post
                          </button>
                        </div>
                      </details>}
                    </div>
                    <p className="whitespace-pre-wrap break-words py-4 text-sm leading-6">{post.body}</p>
                    {post.media_url && post.media_type === "image" && <div className="mb-4 flex w-full min-w-0 justify-center overflow-hidden bg-muted/20"><img src={post.media_url} alt="Post attachment" loading="lazy" className="block h-auto max-h-[560px] w-full max-w-full object-contain object-center" /></div>}
                    {post.media_url && post.media_type === "video" && <div className="mb-4 flex w-full min-w-0 justify-center overflow-hidden bg-black"><video src={post.media_url} controls preload="metadata" className="block h-auto max-h-[560px] w-full max-w-full object-contain object-center" aria-label="Post video attachment" /></div>}
                    <div className="relative flex items-center justify-around gap-4 py-2.5 text-sm text-muted-foreground after:absolute after:bottom-0 after:left-[-1rem] after:right-[-1rem] after:border-b after:border-border sm:after:left-[-1.25rem] sm:after:right-[-1.25rem]">
                      <button type="button" disabled={toggleReaction.isPending} onClick={() => toggleReaction.mutate({ postId: post.id, reacted })} className={cn("flex flex-1 items-center justify-center gap-2 px-2 py-1.5 transition-colors hover:text-foreground", reacted && "text-destructive")} aria-label={reacted ? "Unlike post" : "Like post"} aria-pressed={reacted}>
                        <Heart className={cn("h-5 w-5", reacted && "fill-current")} /> <span>{postReactions.length}</span>
                      </button>
                      <span className="flex flex-1 items-center justify-center gap-2 px-2 py-1.5" aria-label={`${postComments.length} comments`}><MessageCircle className="h-5 w-5" /> <span>{postComments.length}</span></span>
                      <button type="button" aria-label="Share post" title="Share post" onClick={() => {
                        const shareText = post.body + "\n\n" + window.location.origin + "/console/social";
                        if (navigator.share) {
                          void navigator.share({ title: "MAS post by " + displayName(author), text: post.body, url: window.location.origin + "/console/social" }).catch(() => undefined);
                        } else {
                          void navigator.clipboard.writeText(shareText).then(() => toast.success("Post copied for sharing")).catch(() => toast.error("Could not copy post"));
                        }
                      }} className="flex flex-1 items-center justify-center gap-2 px-2 py-1.5 hover:text-foreground"><Share2 className="h-5 w-5" /></button>
                    </div>
                    {commentsQuery.isError && <p role="alert" className="pt-3 text-xs text-destructive">Comments could not load. Refresh to try again.</p>}
                    {postComments.slice(-5).map((comment) => {
                      const commentAuthor = profileMap.get(comment.author_id) ?? (comment.author_id === userId ? profile as SocialProfile : null);
                      const isOwnComment = comment.author_id === userId;
                      const isEditing = editingCommentId === comment.id;
                      return (
                        <div key={comment.id} className={cn("flex items-start gap-2 pt-3", isOwnComment && "flex-row-reverse")}>
                          <Avatar profile={commentAuthor} size="sm" />
                          <div className={cn("social-comment-bubble min-w-0 max-w-[88%] flex-1 border border-border/60 px-3 py-2", isOwnComment ? "bg-primary/10" : "bg-muted/50")}>
                            <div className="mb-1 flex items-center justify-between gap-3">
                              <p className="truncate text-xs font-semibold">{displayName(commentAuthor)}</p>
                              {isOwnComment && !isEditing && (
                                <div className="flex shrink-0 items-center gap-1">
                                  <button type="button" onClick={() => { setEditingCommentId(comment.id); setEditingCommentDraft(comment.body); }} aria-label="Edit comment" title="Edit comment" className="rounded-full p-1 text-muted-foreground hover:bg-background hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                                  <button type="button" disabled={deleteComment.isPending} onClick={() => { if (window.confirm("Delete this comment? This cannot be undone.")) deleteComment.mutate(comment.id); }} aria-label="Delete comment" title="Delete comment" className="rounded-full p-1 text-muted-foreground hover:bg-background hover:text-destructive disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
                                </div>
                              )}
                            </div>
                            {isEditing ? (
                              <form onSubmit={(event) => { event.preventDefault(); editComment.mutate({ commentId: comment.id, body: editingCommentDraft }); }} className="space-y-2">
                                <textarea value={editingCommentDraft} onChange={(event) => setEditingCommentDraft(event.target.value)} maxLength={1000} rows={2} autoFocus aria-label="Edit comment" className="w-full resize-y border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary" />
                                <div className="flex justify-end gap-2">
                                  <button type="button" onClick={() => { setEditingCommentId(null); setEditingCommentDraft(""); }} className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                                  <button type="submit" disabled={!editingCommentDraft.trim() || editComment.isPending} className="bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50">{editComment.isPending ? "Saving…" : "Save"}</button>
                                </div>
                              </form>
                            ) : (
                              <p className="whitespace-pre-wrap break-words text-sm">{comment.body}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <form onSubmit={(event) => submitComment(event, post.id)} className="mt-3 flex items-center gap-2">
                      <label className="sr-only" htmlFor={`comment-${post.id}`}>Write a comment</label>
                      <input id={`comment-${post.id}`} value={commentDrafts[post.id] ?? ""} onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))} maxLength={1000} placeholder="Write a comment…" className="min-w-0 flex-1 rounded-full border border-border/80 bg-background px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10" />
                      <button type="submit" disabled={!(commentDrafts[post.id] ?? "").trim() || addComment.isPending} aria-label="Send comment" className="rounded-full border border-border p-2 hover:bg-secondary disabled:opacity-50"><Send className="h-4 w-4" /></button>
                    </form>
                  </article>
                );
              })}
            </div>
          ) : activeSection === "My Profile" ? (
            <div className="mx-auto w-full max-w-3xl space-y-3 px-0 pb-8 pt-0 sm:px-4">
              <section className="border-y border-border bg-background sm:border-x">
                <div className="h-24 bg-gradient-to-r from-primary/20 via-primary/10 to-muted sm:h-32" aria-hidden="true" />
                <div className="px-4 pb-5 sm:px-6">
                  <div className="-mt-12 flex items-end justify-between gap-3 sm:-mt-14">
                    <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-background bg-secondary sm:h-28 sm:w-28">
                      {ownAvatar ? <img src={ownAvatar} alt="Your profile" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-3xl font-semibold">{(profile?.developer_name || profile?.display_name || "M").slice(0, 1).toUpperCase()}</span>}
                    </div>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      {profile?.is_developer && <button type="button" onClick={() => {
                        const url = window.location.origin + `/developers/${userId}`;
                        if (navigator.share) {
                          void navigator.share({ title: "My Malawian App Store profile", url }).catch(() => undefined);
                        } else {
                          void navigator.clipboard.writeText(url).then(() => toast.success("Profile link copied")).catch(() => toast.error("Could not copy profile link"));
                        }
                      }} className="inline-flex items-center gap-2 border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary">
                        <Share2 className="h-4 w-4" /> Share
                      </button>}
                      <Link to="/settings" className="inline-flex items-center gap-2 border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary">
                        Edit profile
                      </Link>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold tracking-tight">{profile?.developer_name || profile?.display_name || "Your profile"}</h2>
                    {profile?.kyc_status === "approved" && <BadgeCheck className="h-5 w-5 text-primary" aria-label="Verified developer" />}
                    {profile?.is_developer && <span className="border border-primary/30 px-2 py-0.5 text-xs font-medium text-primary">Developer</span>}
                  </div>
                  {profile?.developer_name && profile?.display_name && profile.developer_name !== profile.display_name && (
                    <p className="mt-1 text-sm text-muted-foreground">{profile.display_name}</p>
                  )}
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                    {profile?.bio || "Add a short bio to introduce yourself to the MAS community."}
                  </p>
                  <div className="mt-4 grid grid-cols-3 border-y border-border py-3 text-center">
                    <div><p className="text-lg font-semibold">{myPostsQuery.data?.count ?? 0}</p><p className="text-xs text-muted-foreground">Posts</p></div>
                    <div><p className="text-lg font-semibold">{acceptedIds.size}</p><p className="text-xs text-muted-foreground">Friends</p></div>
                    <div><p className="text-lg font-semibold">{myListingsQuery.data?.length ?? 0}</p><p className="text-xs text-muted-foreground">Published listings</p></div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                    {[
                      ["Website", profile?.website_url],
                      ["Portfolio", profile?.portfolio_url],
                      ["GitHub", profile?.github_url],
                      ["Instagram", profile?.instagram_url],
                      ["Facebook", profile?.facebook_url],
                      ["X", profile?.x_url],
                      ["LinkedIn", profile?.linkedin_url],
                      ["YouTube", profile?.youtube_url],
                      ["WhatsApp", profile?.whatsapp_url],
                    ].filter((item): item is [string, string] => Boolean(item[1]))
                      .map(([label, url]) => (
                        <a key={label} href={url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-primary hover:underline">
                          {label}<ExternalLink className="h-3 w-3" />
                        </a>
                      ))}
                  </div>
                  {profile?.is_developer && (
                    <a href={`/developers/${userId}`} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                      View public developer page <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </section>

              {profile?.is_developer && (
                <section className="border-y border-border bg-background sm:border-x">
                  <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
                    <div><h3 className="font-semibold">Your published apps & websites</h3><p className="mt-0.5 text-xs text-muted-foreground">Your work available in the MAS store.</p></div>
                    <Link to="/console/store" className="text-sm font-medium text-primary hover:underline">Manage</Link>
                  </div>
                  {myListingsQuery.isLoading ? <p className="px-4 py-5 text-sm text-muted-foreground">Loading published listings…</p> : myListingsQuery.isError ? (
                    <p role="alert" className="px-4 py-5 text-sm text-destructive">Could not load your published listings.</p>
                  ) : myListingsQuery.data?.length ? (
                    <div>{myListingsQuery.data.map((listing) => (
                      <a key={listing.id} href={`/apps/${listing.slug}`} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/40">
                        {listing.icon_url ? <img src={listing.icon_url} alt="" loading="lazy" className="h-11 w-11 shrink-0 object-cover" /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-secondary"><Package className="h-5 w-5" /></span>}
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{listing.name}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{listing.tagline || (listing.kind === "app" ? "App" : "Website")}</span></span>
                        <span className="shrink-0 text-right text-xs text-muted-foreground">{listing.downloads ?? 0} downloads</span>
                      </a>
                    ))}</div>
                  ) : (
                    <div className="px-4 py-6 text-sm text-muted-foreground">No published listings yet. Your published apps and websites will appear here.</div>
                  )}
                </section>
              )}

              {profile?.is_developer && (
                <section className="border-y border-border bg-background sm:border-x">
                  <div className="border-b border-border px-4 py-3 sm:px-6">
                    <h3 className="font-semibold">Featured projects</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">Showcase apps and websites published outside MAS. Your MAS listings appear automatically above.</p>
                  </div>
                  <form onSubmit={(event) => { event.preventDefault(); addExternalProject.mutate(); }} className="grid gap-3 border-b border-border px-4 py-4 sm:px-6">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-1.5"><label htmlFor="portfolio-project-title" className="text-xs font-medium">Project name *</label><input id="portfolio-project-title" value={projectTitle} onChange={(event) => setProjectTitle(event.target.value)} maxLength={100} required placeholder="e.g. My business website" className="min-w-0 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" /></div>
                      <div className="grid gap-1.5"><label htmlFor="portfolio-project-type" className="text-xs font-medium">Project type</label><select id="portfolio-project-type" value={projectType} onChange={(event) => setProjectType(event.target.value as typeof projectType)} className="min-w-0 rounded-md border border-border bg-background px-3 py-2 text-sm"><option value="app">App</option><option value="website">Website</option><option value="game">Game</option><option value="tool">Tool</option><option value="other">Other</option></select></div>
                    </div>
                    <div className="grid gap-1.5"><label htmlFor="portfolio-project-url" className="text-xs font-medium">Public project URL (HTTPS) *</label><input id="portfolio-project-url" type="url" value={projectUrl} onChange={(event) => setProjectUrl(event.target.value)} required placeholder="https://example.com" className="min-w-0 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" /></div>
                    <div className="grid gap-1.5"><label htmlFor="portfolio-project-image" className="text-xs font-medium">Preview image URL (optional, HTTPS)</label><input id="portfolio-project-image" type="url" value={projectImageUrl} onChange={(event) => setProjectImageUrl(event.target.value)} placeholder="https://example.com/preview.png" className="min-w-0 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" /></div>
                    <div className="grid gap-1.5"><label htmlFor="portfolio-project-description" className="text-xs font-medium">Short description</label><textarea id="portfolio-project-description" value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} maxLength={500} rows={2} placeholder="What does this project do?" className="min-w-0 resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" /></div>
                    <div><button type="submit" disabled={addExternalProject.isPending || !projectTitle.trim() || !projectUrl.trim()} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"><Plus className="h-4 w-4" />{addExternalProject.isPending ? "Adding…" : "Add project"}</button></div>
                  </form>
                  {externalProjectsQuery.isLoading ? <p className="px-4 py-5 text-sm text-muted-foreground">Loading featured projects…</p> : externalProjectsQuery.isError ? <p role="alert" className="px-4 py-5 text-sm text-destructive">Could not load featured projects. The portfolio database migration may not have been applied yet.</p> : externalProjectsQuery.data?.length ? (
                    <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6">
                      {externalProjectsQuery.data.map((project) => <article key={project.id} className="min-w-0 overflow-hidden border border-border">
                        {project.image_url ? <img src={project.image_url} alt="" loading="lazy" className="h-36 w-full object-cover" /> : <div className="flex h-24 items-center justify-center bg-muted"><Globe className="h-7 w-7 text-muted-foreground" /></div>}
                        <div className="p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="break-words text-sm font-semibold">{project.title}</p><p className="mt-1 text-xs capitalize text-muted-foreground">{project.project_type}</p></div><button type="button" onClick={() => { if (window.confirm("Remove this project from your portfolio?")) removeExternalProject.mutate(project.id); }} disabled={removeExternalProject.isPending} aria-label={"Remove " + project.title} className="shrink-0 p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button></div>
                          {project.description && <p className="mt-2 break-words text-sm text-muted-foreground">{project.description}</p>}
                          <a href={project.url} target="_blank" rel="noreferrer noopener" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">Open project <ExternalLink className="h-3 w-3" /></a>
                        </div>
                      </article>)}
                    </div>
                  ) : <p className="px-4 py-5 text-sm text-muted-foreground">No external projects added yet. Add a website or app published on another platform.</p>}
                </section>
              )}

              <section className="border-y border-border bg-background sm:border-x">
                <div className="border-b border-border px-4 py-3 sm:px-6"><h3 className="font-semibold">Your recent posts</h3><p className="mt-0.5 text-xs text-muted-foreground">Updates you have shared with the community.</p></div>
                {myPostsQuery.isLoading ? <p className="px-4 py-5 text-sm text-muted-foreground">Loading your posts…</p> : myPostsQuery.isError ? (
                  <p role="alert" className="px-4 py-5 text-sm text-destructive">Could not load your posts.</p>
                ) : myPostsQuery.data?.posts.length ? (
                  myPostsQuery.data.posts.map((post) => (
                    <article key={post.id} className="border-b border-border px-4 py-4 last:border-b-0">
                      <time className="text-xs text-muted-foreground" dateTime={post.created_at}>{new Date(post.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{post.body}</p>
                      {post.media_url && post.media_type === "image" && <div className="mt-3 flex w-full min-w-0 justify-center overflow-hidden"><img src={post.media_url} alt="Your post attachment" loading="lazy" className="block h-auto max-h-72 max-w-full object-contain object-center" /></div>}
                      {post.media_url && post.media_type === "video" && <div className="mt-3 flex w-full min-w-0 justify-center overflow-hidden"><video src={post.media_url} controls preload="metadata" className="block h-auto max-h-72 max-w-full object-contain object-center" aria-label="Your post video" /></div>}
                    </article>
                  ))
                ) : (
                  <div className="px-4 py-7 text-center"><p className="text-sm font-medium">No posts yet</p><p className="mt-1 text-sm text-muted-foreground">Share an update from the Feed tab to get started.</p><button type="button" onClick={() => setActiveSection("Feed")} className="mt-3 border border-border px-3 py-2 text-sm hover:bg-secondary">Create a post</button><DemoPreview title="Profile posts · sample view" description="Examples of updates a developer might share." items={[{ title: "Mlimi Connect is live", detail: "We’ve launched a new way to organise farm activities.", metric: "12 reactions · 3 comments", status: "Sample post" }, { title: "Looking for beta testers", detail: "Help test the next Campus Hub release.", metric: "6 replies · 2 shares", status: "Sample post" }]} /></div>
                )}
              </section>
            </div>
          ) : activeSection === "Friends" ? (
            <div className="w-full pb-6 pt-3">
              {incoming.length > 0 && <section className="w-full bg-background">
                <h3 className="px-4 pt-4 text-sm font-semibold">Friend requests ({incoming.length})</h3>
                {incoming.map((request) => {
                  const person = profileMap.get(request.requester_id);
                  return <div key={request.id} className="flex items-center gap-3 border-b border-border px-4 py-3"><Avatar profile={person} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{displayName(person)}</p><p className="text-xs text-muted-foreground">Wants to connect with you</p></div><button type="button" disabled={respondConnection.isPending} onClick={() => respondConnection.mutate({ id: request.id, status: "accepted" })} className="border border-border p-2 hover:bg-secondary disabled:opacity-50" aria-label="Accept friend request"><Check className="h-4 w-4" /></button><button type="button" disabled={respondConnection.isPending} onClick={() => respondConnection.mutate({ id: request.id, status: "declined" })} className="border border-border p-2 hover:bg-secondary disabled:opacity-50" aria-label="Decline friend request"><X className="h-4 w-4" /></button></div>;
                })}
              </section>}
              <div className="w-full bg-background">{renderPeople()}</div>
            </div>
          ) : activeSection === "Search" ? (
            <div className="w-full pb-6 pt-0">
              <div className="w-full px-4 py-3 sm:px-6 lg:px-8"><label htmlFor="social-search" className="sr-only">Search people</label><div className="flex items-center gap-2 rounded-full border border-border bg-background px-4"><Search className="h-4 w-4 shrink-0 text-muted-foreground" /><input id="social-search" autoFocus value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search people by name or bio…" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none" /></div></div>
              <div className="w-full bg-background">{renderPeople()}</div>
            </div>
          ) : activeSection === "Messages" ? (
            <div className="grid w-full grid-cols-1 overflow-hidden border-y border-border/80 bg-background md:grid-cols-[240px_minmax(0,1fr)]">
              <aside className={cn("border-b border-border md:border-b-0 md:border-r", selectedRecipient && "hidden md:block")}>
                {(profilesQuery.data ?? []).filter((person) => person.id !== userId && (acceptedIds.has(person.id) || (messagesQuery.data ?? []).some((message) => message.sender_id === person.id || message.recipient_id === person.id))).map((person) => {
                  const last = [...(messagesQuery.data ?? [])].reverse().find((message) => message.sender_id === person.id || message.recipient_id === person.id);
                  return <button key={person.id} type="button" onClick={() => setSelectedRecipient(person.id)} className={cn("flex w-full items-center gap-2 border-b border-border px-3 py-3 text-left hover:bg-secondary", selectedRecipient === person.id && "bg-secondary")}><Avatar profile={person} size="sm" /><span className="min-w-0 flex-1 truncate text-sm">{displayName(person)}{last?.sender_id === person.id && last.recipient_id === userId && !last.read_at ? <span className="block text-xs font-semibold text-primary">New message</span> : null}</span></button>;
                })}
              </aside>
              <section className={cn("flex min-h-[min(65vh,560px)] min-w-0 flex-col", !selectedRecipient && "hidden md:flex")}>
                {selectedRecipient && selectedProfile ? <>
                  <header className="flex items-center gap-3 border-b border-border px-3 py-3 sm:px-4"><button type="button" onClick={() => setSelectedRecipient(null)} className="flex h-9 w-9 shrink-0 items-center justify-center text-muted-foreground hover:bg-secondary md:hidden" aria-label="Back to conversations"><ArrowLeft className="h-5 w-5" /></button><Avatar profile={selectedProfile} size="sm" /><div className="min-w-0"><p className="truncate text-sm font-semibold">{displayName(selectedProfile)}</p><p className="text-xs text-muted-foreground">Private conversation</p></div></header>
                  <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                    {threadMessages.length ? threadMessages.map((message) => <div key={message.id} className={cn("flex", message.sender_id === userId ? "justify-end" : "justify-start")}><div className={cn("max-w-[85%] whitespace-pre-wrap break-words px-3 py-2 text-sm", message.sender_id === userId ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}>{message.body}<time className="mt-1 block text-[10px] opacity-70">{new Date(message.created_at).toLocaleString()}</time></div></div>) : <p className="py-8 text-center text-sm text-muted-foreground">Say hello to start this conversation.</p>}
                  </div>
                  <form onSubmit={submitMessage} className="flex gap-2 border-t border-border p-3"><label htmlFor="social-message" className="sr-only">Message</label><input id="social-message" value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} maxLength={4000} placeholder="Write a message…" className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary" /><button type="submit" disabled={!messageDraft.trim() || sendMessage.isPending} aria-label="Send message" className="rounded-full bg-primary p-2.5 text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4" /></button></form>
                </> : <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center"><MessageCircle className="h-8 w-8 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">Your messages</p><p className="mt-1 max-w-xs text-sm text-muted-foreground">Choose a conversation to start messaging.</p></div>}
              </section>
            </div>
          ) : activeSection === "Notifications" ? (
            <SocialNotificationsPanel userId={userId} />
          ) : activeSection === "Find Investors" ? (
            <InvestGrowPanel
              userId={userId}
              members={profilesQuery.data ?? []}
              acceptedIds={acceptedIds}
              onConnect={(recipientId) => sendConnection.mutate(recipientId)}
              onMessage={(recipientId) => { setSelectedRecipient(recipientId); setActiveSection("Messages"); }}
            />
          ) : activeSection === "Monetization" ? (
            <div className="w-full px-4 pb-8 pt-4 sm:px-6 lg:px-8">
              <header className="pb-5">
                <div className="flex items-start gap-3">
                  <Wallet className="mt-1 h-6 w-6 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-xl font-bold">Creator monetization</h2>
                      <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Setup pending</span>
                    </div>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Build an audience, share useful work, and prepare to earn through MAS Social.</p>
                  </div>
                </div>
                <p className="mt-4 border-l-2 border-amber-500 pl-3 text-sm leading-6 text-muted-foreground">
                  Social payments are not active yet. Verified checkout, earnings records, refunds and payouts must be connected before these options can accept money.
                </p>
              </header>

              <section aria-label="Creator earning options" className="divide-y divide-border border-y border-border">
                <article className="flex gap-3 py-4">
                  <Heart className="mt-1 h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><h3 className="font-semibold">Tips and support</h3><span className="text-xs text-muted-foreground">Planned · free and paid accounts</span></div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">Let followers support eligible creators without requiring creators to subscribe first.</p>
                  </div>
                </article>
                <article className="flex gap-3 py-4">
                  <Users className="mt-1 h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><h3 className="font-semibold">Paid memberships</h3><span className="text-xs text-muted-foreground">Planned · creator subscription required</span></div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">Offer member-only updates, private communities and recurring benefits.</p>
                  </div>
                </article>
                <article className="flex gap-3 py-4">
                  <Package className="mt-1 h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><h3 className="font-semibold">Paid posts and products</h3><span className="text-xs text-muted-foreground">Planned · payments required</span></div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">Sell tutorials and digital resources or link to products that can lead to eligible purchases.</p>
                  </div>
                </article>
                <article className="flex gap-3 py-4">
                  <Megaphone className="mt-1 h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><h3 className="font-semibold">Sponsored content</h3><span className="text-xs text-muted-foreground">Planned · advertiser rules required</span></div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">Partner with advertisers through approved, clearly labelled sponsored posts.</p>
                  </div>
                </article>
                <article className="flex gap-3 py-4">
                  <Users className="mt-1 h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><h3 className="font-semibold">Referral commissions</h3><span className="text-xs text-muted-foreground">Planned · tracking required</span></div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">Earn from trackable referrals that result in verified purchases. Self-referrals and fraud should not qualify.</p>
                  </div>
                </article>
              </section>

              <section className="mt-6">
                <h3 className="font-semibold">Manage your setup</h3>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">The wallet is intended to bring marketplace sales and eligible Social earnings together. Balances will appear only after real transactions are recorded.</p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                  <Link to="/console/wallet" className="inline-flex items-center text-sm font-medium text-primary hover:underline">Wallet & earnings <ExternalLink className="ml-1.5 h-4 w-4" /></Link>
                  <Link to="/console/subscription" className="inline-flex items-center text-sm font-medium text-primary hover:underline">Developer Pro <ExternalLink className="ml-1.5 h-4 w-4" /></Link>
                  <Link to="/advertise" className="inline-flex items-center text-sm font-medium text-primary hover:underline">Advertising <ExternalLink className="ml-1.5 h-4 w-4" /></Link>
                </div>
              </section>
            </div>
          ) : (
            <div className="px-4 py-8 text-sm text-muted-foreground">Choose a social section to continue.</div>
          )}
        </main>
      </section>
    </ConsoleShell>
  );
}
