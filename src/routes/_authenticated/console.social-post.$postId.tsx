import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MessageCircle, Mic, Pencil, Reply, Send, StopCircle, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { ConsoleShell } from "@/components/console/ConsoleShell";
import { useProfile, useSignedUrl } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const socialDb = supabase as any;

export const Route = createFileRoute("/_authenticated/console/social-post/$postId")({
  component: SocialPostDiscussionPage,
});

type SocialProfile = { id: string; display_name: string | null; developer_name?: string | null; avatar_url: string | null };
type SocialPost = { id: string; author_id: string; body: string; created_at: string; media_url: string | null; media_type: "image" | "video" | null };
type SocialComment = { id: string; post_id: string; author_id: string; body: string; created_at: string; parent_comment_id: string | null; media_url: string | null; media_type: "audio" | null };

function displayName(profile?: SocialProfile | null) {
  return profile?.developer_name || profile?.display_name || "MAS member";
}

function Avatar({ profile, size = "md" }: { profile?: SocialProfile | null; size?: "sm" | "md" }) {
  const signed = useSignedUrl(profile?.avatar_url);
  const src = signed ?? (profile?.avatar_url?.startsWith("https://") ? profile.avatar_url : null);
  const label = displayName(profile);
  return src
    ? <img src={src} alt="" loading="lazy" className={cn("shrink-0 rounded-full object-cover", size === "sm" ? "h-8 w-8" : "h-10 w-10")} />
    : <span aria-hidden="true" className={cn("flex shrink-0 items-center justify-center rounded-full bg-secondary font-semibold", size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm")}>{label.slice(0, 1).toUpperCase()}</span>;
}

function AudioRecorder({ value, onChange }: { value: Blob | null; onChange: (blob: Blob | null) => void }) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const previewUrl = useMemo(() => value ? URL.createObjectURL(value) : null, [value]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function startRecording() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find((item) => MediaRecorder.isTypeSupported(item));
      const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > 15 * 1024 * 1024) setError("Recording is too large. Keep voice comments under 15 MB.");
        else if (blob.size) onChange(blob);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setRecording(false);
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        timerRef.current = null;
      };
      recorder.start(250);
      setRecording(true);
      timerRef.current = window.setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 60_000);
    } catch (cause) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setError(cause instanceof Error && cause.name === "NotAllowedError"
        ? "Microphone permission was denied. Allow microphone access and try again."
        : "Could not start recording. Check your microphone and try again.");
    }
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {recording
        ? <button type="button" onClick={() => recorderRef.current?.state === "recording" && recorderRef.current.stop()} className="inline-flex items-center gap-2 rounded-full border border-destructive/40 px-3 py-2 text-xs font-medium text-destructive"><StopCircle className="h-4 w-4" /> Stop recording</button>
        : value
          ? <div className="flex min-w-0 flex-wrap items-center gap-2"><audio controls src={previewUrl ?? undefined} className="h-9 max-w-[220px]" /><button type="button" onClick={() => onChange(null)} aria-label="Remove voice recording" className="rounded-full p-2 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button></div>
          : <button type="button" onClick={() => void startRecording()} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"><Mic className="h-4 w-4" /> Record voice</button>}
      {recording && <span className="text-xs text-destructive">Recording · max 60 seconds</span>}
      {error && <p role="alert" className="w-full text-xs text-destructive">{error}</p>}
    </div>
  );
}

function SocialPostDiscussionPage() {
  const { postId } = Route.useParams();
  const { userId, profile } = useProfile();
  const navigate = useNavigate();
  const fromSocialFeed = useRouterState({ select: (state) => (state.location.state as { fromSocialFeed?: boolean } | undefined)?.fromSocialFeed === true });
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [voiceClip, setVoiceClip] = useState<Blob | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const postQuery = useQuery({
    queryKey: ["social", "post", postId],
    enabled: Boolean(userId && postId),
    queryFn: async () => {
      const { data, error } = await socialDb.from("social_posts")
        .select("id, author_id, body, created_at, media_url, media_type")
        .eq("id", postId).maybeSingle();
      if (error) throw error;
      return (data ?? null) as SocialPost | null;
    },
  });

  const commentsQuery = useQuery({
    queryKey: ["social", "comments", postId],
    enabled: Boolean(userId && postQuery.data?.id),
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await socialDb.from("social_post_comments")
        .select("id, post_id, author_id, body, created_at, parent_comment_id, media_url, media_type")
        .eq("post_id", postId).order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SocialComment[];
    },
  });

  const profileIds = useMemo(() => Array.from(new Set([
    ...(postQuery.data?.author_id ? [postQuery.data.author_id] : []),
    ...(commentsQuery.data ?? []).map((comment) => comment.author_id),
  ])), [commentsQuery.data, postQuery.data?.author_id]);

  const profilesQuery = useQuery({
    queryKey: ["social", "discussion-profiles", profileIds.join(",")],
    enabled: Boolean(userId && profileIds.length),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await socialDb.from("public_profiles")
        .select("id, display_name, developer_name, avatar_url").in("id", profileIds);
      if (error) throw error;
      return (data ?? []) as SocialProfile[];
    },
  });

  const profileMap = useMemo(() => new Map((profilesQuery.data ?? []).map((item) => [item.id, item])), [profilesQuery.data]);
  const commentsByParent = useMemo(() => {
    const grouped = new Map<string | null, SocialComment[]>();
    for (const comment of commentsQuery.data ?? []) {
      const group = grouped.get(comment.parent_comment_id);
      if (group) group.push(comment);
      else grouped.set(comment.parent_comment_id, [comment]);
    }
    return grouped;
  }, [commentsQuery.data]);

  const addComment = useMutation({
    mutationFn: async () => {
      const body = draft.trim();
      if (!body && !voiceClip) throw new Error("Write a comment or record a voice comment.");
      if (body.length > 1000) throw new Error("Comments must be 1,000 characters or fewer.");
      let mediaUrl: string | null = null;
      let uploadedPath: string | null = null;
      if (voiceClip) {
        const mime = voiceClip.type || "audio/webm";
        const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : mime.includes("mpeg") ? "mp3" : "webm";
        uploadedPath = String(userId) + "/comments/" + postId + "/" + Date.now() + "-" + Math.random().toString(36).slice(2) + "." + ext;
        const { error: uploadError } = await supabase.storage.from("social-media").upload(uploadedPath, voiceClip, { cacheControl: "3600", contentType: mime.split(";")[0], upsert: false });
        if (uploadError) throw uploadError;
        mediaUrl = supabase.storage.from("social-media").getPublicUrl(uploadedPath).data.publicUrl;
      }
      const { error } = await socialDb.from("social_post_comments").insert({
        post_id: postId, author_id: userId, body, parent_comment_id: replyToId,
        media_url: mediaUrl, media_type: mediaUrl ? "audio" : null,
      });
      if (error) {
        if (uploadedPath) await supabase.storage.from("social-media").remove([uploadedPath]);
        throw error;
      }
    },
    onSuccess: async () => {
      setDraft(""); setReplyToId(null); setVoiceClip(null);
      await queryClient.invalidateQueries({ queryKey: ["social", "comments"] });
      toast.success(replyToId ? "Reply posted" : "Comment posted");
    },
    onError: (error: Error) => toast.error(error.message || "Could not post comment"),
  });

  const editComment = useMutation({
    mutationFn: async ({ commentId, body }: { commentId: string; body: string }) => {
      const nextBody = body.trim();
      if (!nextBody || nextBody.length > 1000) throw new Error("Enter a comment under 1,000 characters.");
      const comment = (commentsQuery.data ?? []).find((item) => item.id === commentId);
      if (!comment || comment.author_id !== userId) throw new Error("You can only edit your own comments.");
      const { data, error } = await socialDb.from("social_post_comments")
        .update({ body: nextBody }).eq("id", commentId).eq("author_id", userId).select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Comment was not updated. Refresh and try again.");
    },
    onSuccess: async () => {
      setEditingCommentId(null); setEditingDraft("");
      await queryClient.invalidateQueries({ queryKey: ["social", "comments", postId] });
      toast.success("Comment updated");
    },
    onError: (error: Error) => toast.error(error.message || "Could not edit comment"),
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      const comment = (commentsQuery.data ?? []).find((item) => item.id === commentId);
      if (!comment || comment.author_id !== userId) throw new Error("You can only delete your own comments.");
      if ((commentsQuery.data ?? []).some((item) => item.parent_comment_id === commentId)) {
        throw new Error("Delete the replies first, then delete this comment.");
      }
      const { data, error } = await socialDb.from("social_post_comments")
        .delete().eq("id", commentId).eq("author_id", userId).select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Comment was not deleted. Refresh and try again.");
      if (comment.media_url) {
        const marker = "/object/public/social-media/";
        const index = comment.media_url.indexOf(marker);
        const path = index >= 0 ? decodeURIComponent(comment.media_url.slice(index + marker.length)) : "";
        if (path.startsWith(String(userId) + "/")) {
          const { error: storageError } = await supabase.storage.from("social-media").remove([path]);
          if (storageError) console.warn("Voice comment file cleanup failed", storageError.message);
        }
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["social", "comments", postId] });
      toast.success("Comment deleted");
    },
    onError: (error: Error) => toast.error(error.message || "Could not delete comment"),
  });

  const post = postQuery.data;
  const postAuthor = post ? profileMap.get(post.author_id) ?? (post.author_id === userId ? profile as SocialProfile : null) : null;
  const replyTarget = replyToId ? (commentsQuery.data ?? []).find((comment) => comment.id === replyToId) : null;

  function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    addComment.mutate();
  }

  function renderComment(comment: SocialComment, depth = 0, ancestors = new Set<string>()): ReactNode {
    if (ancestors.has(comment.id)) return null;
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(comment.id);
    const author = profileMap.get(comment.author_id) ?? (comment.author_id === userId ? profile as SocialProfile : null);
    const children = commentsByParent.get(comment.id) ?? [];
    const own = comment.author_id === userId;
    const editing = editingCommentId === comment.id;
    return (
      <div key={comment.id} className={cn("min-w-0", depth > 0 && depth <= 4 && "ml-4 border-l border-border pl-3 sm:ml-7 sm:pl-4")}>
        <div className="flex min-w-0 items-start gap-2.5 py-3">
          <Avatar profile={author} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-xs font-semibold">{displayName(author)}</span>
              <time className="text-[10px] text-muted-foreground" dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time>
              {own && !editing && <div className="ml-auto flex items-center gap-1">
                {comment.body.trim() && <button type="button" onClick={() => { setEditingCommentId(comment.id); setEditingDraft(comment.body); }} aria-label="Edit comment" className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary"><Pencil className="h-3.5 w-3.5" /></button>}
                <button type="button" disabled={deleteComment.isPending} onClick={() => { if (window.confirm("Delete this comment? Replies must be deleted first.")) deleteComment.mutate(comment.id); }} aria-label="Delete comment" className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>}
            </div>
            {editing ? (
              <form onSubmit={(event) => { event.preventDefault(); editComment.mutate({ commentId: comment.id, body: editingDraft }); }} className="mt-2 space-y-2">
                <textarea value={editingDraft} onChange={(event) => setEditingDraft(event.target.value)} maxLength={1000} rows={2} autoFocus className="w-full resize-y rounded-lg border border-border bg-background p-2 text-sm outline-none focus:border-primary" aria-label="Edit comment" />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { setEditingCommentId(null); setEditingDraft(""); }} className="px-3 py-1.5 text-xs text-muted-foreground">Cancel</button>
                  <button type="submit" disabled={!editingDraft.trim() || editComment.isPending} className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">{editComment.isPending ? "Saving…" : "Save"}</button>
                </div>
              </form>
            ) : <>
              {comment.body && <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{comment.body}</p>}
              {comment.media_url && comment.media_type === "audio" && <audio controls preload="metadata" src={comment.media_url} className="mt-2 h-9 max-w-full" aria-label={"Voice comment by " + displayName(author)} />}
              <button type="button" onClick={() => { setReplyToId(comment.id); setEditingCommentId(null); composerRef.current?.focus(); }} className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"><Reply className="h-3.5 w-3.5" /> Reply</button>
            </>}
          </div>
        </div>
        {children.map((child) => renderComment(child, depth + 1, nextAncestors))}
      </div>
    );
  }

  return (
    <ConsoleShell title="Social" description="Post discussion" hideTopBar hideTitleCard fullWidth>
      <div className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-3xl flex-col border-x-0 border-border bg-background sm:border-x">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
          <button type="button" onClick={() => { if (fromSocialFeed && window.history.length > 1) window.history.back(); else void navigate({ to: "/console/social" }); }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Back to Social feed"><ArrowLeft className="h-5 w-5" /></button>
          <div className="min-w-0"><h1 className="font-semibold">Post discussion</h1><p className="text-xs text-muted-foreground">{(commentsQuery.data ?? []).length} comments</p></div>
        </header>

        <div className="min-h-0 flex-1 px-4 pb-4">
          {postQuery.isLoading ? <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading post…</div>
            : postQuery.isError ? <p role="alert" className="py-12 text-center text-sm text-destructive">This post could not be loaded. Try again.</p>
            : !post ? <div className="py-14 text-center"><MessageCircle className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-3 font-semibold">Post not found</h2><p className="mt-1 text-sm text-muted-foreground">It may have been deleted or is no longer available.</p><Link to="/console/social" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"><ArrowLeft className="h-4 w-4" /> Back to Social</Link></div>
            : <>
              <article className="border-b border-border py-4">
                <div className="flex items-start gap-3"><Avatar profile={postAuthor} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{displayName(postAuthor)}</p><time className="mt-0.5 block text-xs text-muted-foreground" dateTime={post.created_at}>{new Date(post.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time></div></div>
                <p className="whitespace-pre-wrap break-words py-4 text-sm leading-6">{post.body}</p>
                {post.media_url && post.media_type === "image" && <img src={post.media_url} alt="Post attachment" loading="lazy" className="mb-3 block h-auto max-h-[70svh] w-full object-contain object-center" />}
                {post.media_url && post.media_type === "video" && <video src={post.media_url} controls preload="metadata" className="mb-3 block h-auto max-h-[70svh] w-full object-contain object-center" aria-label="Post video attachment" />}
              </article>
              <section aria-label="Comments" className="divide-y divide-border/70">
                <div className="py-3"><h2 className="text-sm font-semibold">Comments</h2></div>
                {commentsQuery.isLoading ? <p className="py-8 text-sm text-muted-foreground">Loading comments…</p>
                  : commentsQuery.isError ? <p role="alert" className="py-8 text-sm text-destructive">Comments could not load. Refresh to try again.</p>
                  : (commentsQuery.data ?? []).length === 0 ? <div className="py-10 text-center text-sm text-muted-foreground">No comments yet. Start the conversation.</div>
                  : (commentsByParent.get(null) ?? []).map((comment) => renderComment(comment))}
              </section>
            </>}
        </div>

        {post && <div className="sticky bottom-0 z-30 border-t border-border bg-background/95 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-20px_rgba(0,0,0,0.45)] backdrop-blur sm:px-4">
          {replyTarget && <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>Replying to {displayName(profileMap.get(replyTarget.author_id) ?? null)}</span><button type="button" onClick={() => setReplyToId(null)} className="inline-flex items-center gap-1 hover:text-foreground"><X className="h-3.5 w-3.5" /> Cancel reply</button></div>}
          <form onSubmit={submitComment} className="space-y-2">
            <textarea ref={composerRef} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1000} rows={2} placeholder={replyTarget ? "Write a reply…" : "Write a comment…"} aria-label={replyTarget ? "Write a reply" : "Write a comment"} className="max-h-32 min-h-14 w-full resize-y rounded-2xl border border-border bg-muted/30 px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/10" />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <AudioRecorder value={voiceClip} onChange={setVoiceClip} />
              <button type="submit" disabled={addComment.isPending || (!draft.trim() && !voiceClip)} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
                {addComment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {addComment.isPending ? "Posting…" : replyTarget ? "Reply" : "Comment"}
              </button>
            </div>
          </form>
        </div>}
      </div>
    </ConsoleShell>
  );
}
