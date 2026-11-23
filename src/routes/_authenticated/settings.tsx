import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  BadgeCheck,
  Camera,
  ChevronRight,
  Code2,
  Gem,
  Info,
  LogOut,
  Moon,
  Palette,
  Store,
  Settings,
  MessageCircle,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { DEVELOPER_TERMS_VERSION, DeveloperTermsDialog } from "@/components/DeveloperTerms";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useIsAdmin, useMode, useProfile, useSignedUrl } from "@/hooks/useSession";
import { ACCENT_PRESETS, useTheme } from "@/hooks/useTheme";
import { supabase } from "@/integrations/supabase/client";
import { formatMwk, uploadAsset } from "@/lib/store";
import { hasProAccess } from "@/lib/pro-access";
import { startDeveloperTrial } from "@/lib/subscription.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings · Malawian App Store" },
      {
        name: "description",
        content: "Manage your profile, appearance, workspace and account preferences.",
      },
      { property: "og:title", content: "Settings · Malawian App Store" },
      { property: "og:description", content: "Manage your Malawian App Store profile and preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage({ section = "overview" }: { section?: "overview" | "profile" | "appearance" | "workspace" | "account" }) {
  const { userId, profile } = useProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const mode = useMode();
  const isAdmin = useIsAdmin();
  const { dark, setTheme, accent, setAccent } = useTheme();
  const avatar = useSignedUrl(profile?.avatar_url);
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const cover = useSignedUrl(profile?.cover_image_url);
  const [termsOpen, setTermsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);

  const account = useQuery({
    queryKey: ["account-auth-details", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return { email: data.user?.email ?? null, provider: data.user?.app_metadata?.provider ?? "email" };
    },
    staleTime: 5 * 60 * 1000,
  });

  const subscription = useQuery({
    queryKey: ["subscription", userId],
    enabled: Boolean(userId && mode === "developer"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("plan,status,current_period_end")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["profile", userId] }),
      queryClient.invalidateQueries({ queryKey: ["account-auth-details", userId] }),
      queryClient.invalidateQueries({ queryKey: ["social", "profiles"] }),
      queryClient.invalidateQueries({ queryKey: ["developer", userId] }),
    ]);
  };

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sign in required");
      const nextDisplayName = (displayName ?? profile?.display_name ?? "").trim();
      const nextDeveloperName = (profile?.developer_name ?? "").trim();
      const nextBio = (bio ?? profile?.bio ?? "").trim();
      if (nextDisplayName.length > 80) throw new Error("Display name must be 80 characters or fewer");
      if (nextDeveloperName.length > 100) throw new Error("Developer name must be 100 characters or fewer");
      if (nextBio.length > 300) throw new Error("Bio must be 300 characters or fewer");
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: nextDisplayName || null,
          developer_name: nextDeveloperName || null,
          bio: nextBio || null,
        })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Profile saved");
      await refresh();
    },
    onError: (error: Error) => toast.error(error.message || "Could not save profile"),
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      if (!userId) throw new Error("Sign in required");
      if (!file.type.startsWith("image/")) throw new Error("Choose an image file");
      if (file.size > 5 * 1024 * 1024) throw new Error("Profile images must be 5 MB or smaller");
      const path = await uploadAsset(userId, file, "avatars");
      const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Profile photo updated");
      await queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      await queryClient.invalidateQueries({ queryKey: ["signed-url"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not upload profile photo"),
  });

  const uploadCover = useMutation({
    mutationFn: async (file: File) => {
      if (!userId) throw new Error("Sign in required");
      if (!file.type.startsWith("image/")) throw new Error("Choose an image file");
      if (file.size > 8 * 1024 * 1024) throw new Error("Cover images must be 8 MB or smaller");
      const path = await uploadAsset(userId, file, "profile-covers");
      const { error } = await supabase.from("profiles").update({ cover_image_url: path }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Cover picture updated");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile", userId] }),
        queryClient.invalidateQueries({ queryKey: ["social", "profiles"] }),
        queryClient.invalidateQueries({ queryKey: ["signed-url"] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message || "Could not upload cover picture"),
  });

  const beginDeveloperTrial = useServerFn(startDeveloperTrial);
  // Retain the previous workspace only for rollback if developer activation fails.
  const previousWorkspaceRef = useRef({ mode, isDeveloper: profile?.is_developer ?? false });

  const setMode = useMutation({
    onMutate: () => {
      previousWorkspaceRef.current = { mode, isDeveloper: profile?.is_developer ?? false };
    },
    mutationFn: async ({
      next,
      acceptTerms,
    }: {
      next: "developer" | "user";
      acceptTerms?: boolean;
    }) => {
      if (!userId) throw new Error("Sign in required");
      const { error } = await supabase
        .from("profiles")
        .update({
          mode: next,
          is_developer: next === "developer" ? true : (profile?.is_developer ?? false),
          ...(acceptTerms ? { developer_terms_accepted_at: new Date().toISOString(), developer_terms_version: DEVELOPER_TERMS_VERSION } : {}),
        })
        .eq("id", userId);
      if (error) throw error;
      if (next === "developer") await beginDeveloperTrial();
      return next;
    },
    onSuccess: (next, variables) => {
      setTermsOpen(false);
      // Update the cached source of truth immediately so the destination route
      // sees the new mode without waiting for a profile refetch.
      queryClient.setQueryData(["profile", userId], (current: typeof profile) =>
        current
          ? {
              ...current,
              mode: next,
              is_developer: next === "developer" ? true : current.is_developer,
              ...(variables.acceptTerms
                ? { developer_terms_accepted_at: new Date().toISOString(), developer_terms_version: DEVELOPER_TERMS_VERSION }
                : {}),
            }
          : current,
      );
      // Reconcile with the server in the background rather than blocking navigation.
      void queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      toast.success(next === "developer" ? "Developer workspace on" : "Back to the store");
      navigate({ to: next === "developer" ? "/console" : "/", replace: true });
    },
    onError: async (error: Error, variables) => {
      if (variables.next === "developer" && userId) {
        const previous = previousWorkspaceRef.current;
        const { error: rollbackError } = await supabase
          .from("profiles")
          .update({ mode: previous.mode, is_developer: previous.isDeveloper })
          .eq("id", userId);
        queryClient.setQueryData(["profile", userId], (current: typeof profile) =>
          current ? { ...current, mode: previous.mode, is_developer: previous.isDeveloper } : current,
        );
        if (rollbackError) console.error("Could not roll back failed Developer Mode activation:", rollbackError.message);
      }
      toast.error(error.message);
    },
  });

  const settingsMode = mode;

  function toggleDeveloper(on: boolean) {
    if (!on) {
      setMode.mutate({ next: "user" });
      return;
    }
    if (!profile?.developer_terms_accepted_at || profile.developer_terms_version !== DEVELOPER_TERMS_VERSION) {
      setTermsOpen(true);
      return;
    }
    setMode.mutate({ next: "developer" });
  }

  async function signOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      await queryClient.cancelQueries();
      queryClient.clear();
      await navigate({ to: "/auth", replace: true });
    } catch (error) {
      setIsSigningOut(false);
      toast.error(error instanceof Error ? error.message : "Could not sign out. Please try again.");
    }
  }

  if (setMode.isPending) {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-background px-6"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <span
            aria-hidden="true"
            className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent"
          />
          <div>
            <p className="font-semibold">Switching workspace</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your workspace is being updated. This may take a moment.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const initial = (profile?.display_name || profile?.developer_name || account.data?.email || "U")
    .slice(0, 1)
    .toUpperCase();

  return (
    <AppShell>
      <main className="relative isolate mx-auto w-full max-w-4xl overflow-hidden px-3 py-5 sm:px-6 sm:py-7">

        <header className="mb-4">
          {section !== "overview" && <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{({ profile: "Personal information", appearance: "Appearance", workspace: "Workspace", account: "Account" } as const)[section]}</h1>}
          {section !== "overview" && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Manage this part of your MAS account.</p>}
          {section !== "overview" && <Link to="/settings" className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"><ChevronRight className="h-4 w-4 rotate-180" />Back to Settings</Link>}
        </header>
        <div className="mx-auto w-full max-w-4xl min-w-0 space-y-6">
            {section === "overview" && (
              <div className="space-y-7">
                <section className="relative isolate flex min-h-[176px] items-center overflow-hidden rounded-[1.5rem] border border-blue-200/70 bg-gradient-to-r from-sky-50 via-blue-100 to-blue-500 px-4 py-6 dark:border-blue-900/60 dark:from-sky-950 dark:via-blue-950 dark:to-blue-800 sm:min-h-[190px] sm:px-7">
                  <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-[38%] opacity-45" style={{ backgroundImage: "radial-gradient(ellipse at 78% 100%, rgba(255,255,255,.48) 0 19%, transparent 19.5%), repeating-conic-gradient(from 270deg at 78% 100%, rgba(255,255,255,.30) 0deg 1.2deg, transparent 1.2deg 7deg)", clipPath: "ellipse(88% 96% at 78% 100%)" }} />
                  <div className="flex min-w-0 items-center gap-4 sm:gap-7">
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-white/90 bg-white/70 shadow-sm sm:h-32 sm:w-32">
                      {avatar ? <img src={avatar} alt="Your profile" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-3xl font-semibold text-primary">{initial}</div>}
                      <button type="button" onClick={() => avatarInput.current?.click()} aria-label="Change profile photo" className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-sm transition hover:opacity-90"><Camera className="h-4 w-4" /></button>
                    </div>
                    <div className="min-w-0 text-foreground">
                      <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">{profile?.display_name || profile?.developer_name || "Your MAS Account"}{profile?.kyc_status === "approved" && <BadgeCheck aria-label="Verified profile" className="ml-2 inline h-6 w-6 fill-blue-600 text-white align-middle" />}</h1>
                      <p className="mt-1 break-all text-sm text-muted-foreground sm:text-base">{account.data?.email ?? "Loading account email…"}</p>
                      <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-blue-200/70 bg-blue-100/80 px-3 py-1.5 text-sm font-semibold text-blue-800 dark:border-blue-900 dark:bg-blue-950/70 dark:text-blue-200"><Gem className="h-4 w-4 fill-current" />MAS Member</span>
                    </div>
                  </div>
                </section>
                <input ref={avatarInput} type="file" accept="image/*" className="sr-only" aria-label="Choose profile photo" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadAvatar.mutate(file); event.currentTarget.value = ""; }} />
                <header className="flex items-start gap-3 px-1">
                  <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200"><Settings className="h-6 w-6" /></span>
                  <div><h2 className="text-2xl font-bold tracking-tight sm:text-3xl">User Mode Settings</h2><p className="mt-1 text-sm text-muted-foreground sm:text-base">Manage your account and experience</p></div>
                </header>
                <div className="space-y-2.5">
                  <button type="button" onClick={() => navigate({ to: "/settings/profile", replace: true })} className="group flex min-h-[84px] w-full items-center gap-3 rounded-2xl border border-blue-100/80 bg-card/95 px-4 py-3 text-left shadow-sm shadow-blue-950/[0.03] transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[92px] sm:gap-4 sm:px-5">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"><UserRound className="h-7 w-7 fill-current" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-base font-semibold text-foreground">Profile</span><span className="mt-0.5 block text-xs text-muted-foreground sm:text-sm">View and edit your personal information</span></span>
                    <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </button>
                  <button type="button" onClick={() => navigate({ to: "/settings/appearance", replace: true })} className="group flex min-h-[84px] w-full items-center gap-3 rounded-2xl border border-violet-100/80 bg-card/95 px-4 py-3 text-left shadow-sm shadow-blue-950/[0.03] transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[92px] sm:gap-4 sm:px-5">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"><Palette className="h-7 w-7 fill-current" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-base font-semibold text-foreground">Appearance</span><span className="mt-0.5 block text-xs text-muted-foreground sm:text-sm">Customize theme, colours and display</span></span>
                    <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </button>
                  <button type="button" disabled={setMode.isPending} onClick={() => settingsMode === "developer" ? navigate({ to: "/console", replace: true }) : toggleDeveloper(true)} className="group flex min-h-[84px] w-full items-center gap-3 rounded-2xl border border-green-100/80 bg-card/95 px-4 py-3 text-left shadow-sm shadow-blue-950/[0.03] transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:min-h-[92px] sm:gap-4 sm:px-5">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"><Code2 className="h-7 w-7" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-base font-semibold text-foreground">Developer Mode</span><span className="mt-0.5 block text-xs text-muted-foreground sm:text-sm">Access developer tools and console</span></span>
                    <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-semibold ${settingsMode === "developer" ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" : "bg-muted text-muted-foreground"}`}><span className={`h-1.5 w-1.5 rounded-full ${settingsMode === "developer" ? "bg-green-600" : "bg-muted-foreground"}`} />{settingsMode === "developer" ? "Enabled" : "Off"}</span>
                    <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </button>
                  <button type="button" onClick={() => navigate({ to: "/console/social", replace: true })} className="group flex min-h-[84px] w-full items-center gap-3 rounded-2xl border border-orange-100/80 bg-card/95 px-4 py-3 text-left shadow-sm shadow-blue-950/[0.03] transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[92px] sm:gap-4 sm:px-5">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"><UsersRound className="h-7 w-7 fill-current" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-base font-semibold text-foreground">Social</span><span className="mt-0.5 block text-xs text-muted-foreground sm:text-sm">Join the MAS community</span></span>
                    <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </button>
                  <button type="button" disabled={isSigningOut} onClick={() => void signOut()} className="group flex min-h-[84px] w-full items-center gap-3 rounded-2xl border border-rose-100/80 bg-card/95 px-4 py-3 text-left text-destructive shadow-sm shadow-blue-950/[0.03] transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50 sm:min-h-[92px] sm:gap-4 sm:px-5">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"><LogOut className="h-7 w-7" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-base font-semibold">{isSigningOut ? "Signing out…" : "Sign Out"}</span><span className="mt-0.5 block text-xs text-muted-foreground sm:text-sm">Leave your account securely</span></span>
                    <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
                <div className="flex min-h-[64px] items-center justify-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/90 px-4 py-3 text-center text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-100"><Info className="h-5 w-5 shrink-0 fill-current text-blue-600 dark:text-blue-300" /><span>Enjoy a better experience with Malawian App Store! 🇲🇼</span></div>
              </div>
            )}
            {section === "profile" && (
<section id="profile" className="scroll-mt-24 rounded-2xl border border-border/70 bg-background/90 p-4 sm:p-5">
              <div className="mb-4"><h2 className="text-xl font-semibold tracking-tight">Personal information</h2><p className="mt-1 text-sm text-muted-foreground">Manage the information shown on your MAS profile.</p></div>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-accent/30 text-2xl font-semibold text-accent-foreground">{avatar ? <img src={avatar} alt="Your profile" className="h-full w-full object-cover" /> : <span>{initial}</span>}</div>
                <div className="min-w-0 flex-1"><p className="font-semibold">{profile?.display_name || "Your name"}</p><p className="mt-1 break-all text-sm text-muted-foreground">{account.data?.email ?? "Loading account email…"}</p>
                  {profile?.is_developer ? <Link to="/console/store" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">Manage public developer profile <ChevronRight className="h-4 w-4" /></Link> : <><button type="button" onClick={() => avatarInput.current?.click()} disabled={uploadAvatar.isPending} className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline disabled:opacity-50"><Camera className="h-4 w-4" />{uploadAvatar.isPending ? "Uploading photo…" : "Change profile photo"}</button><input ref={avatarInput} type="file" accept="image/*" className="sr-only" aria-label="Choose profile photo" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadAvatar.mutate(file); event.currentTarget.value = ""; }} /><p className="mt-1 text-xs text-muted-foreground">Images up to 5 MB.</p></>}
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <div className="space-y-2"><p className="text-sm font-medium">Cover picture</p><div className="relative h-28 overflow-hidden rounded-2xl bg-muted sm:h-36">{cover ? <img src={cover} alt="Your profile cover" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No cover picture selected</div>}</div><button type="button" onClick={() => coverInput.current?.click()} disabled={uploadCover.isPending} className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline disabled:opacity-50"><Camera className="h-4 w-4" />{uploadCover.isPending ? "Uploading cover…" : cover ? "Change cover picture" : "Add cover picture"}</button><input ref={coverInput} type="file" accept="image/*" className="sr-only" aria-label="Choose profile cover picture" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadCover.mutate(file); event.currentTarget.value = ""; }} /><p className="text-xs text-muted-foreground">Wide images up to 8 MB.</p></div>
                <div className="grid gap-2"><Label htmlFor="display" className="text-sm">Display name</Label><input id="display" value={displayName ?? profile?.display_name ?? ""} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} placeholder="How should we call you?" className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /><p className="text-xs text-muted-foreground">Up to 80 characters.</p></div>
                {profile?.is_developer ? <p className="text-sm leading-6 text-muted-foreground">Your developer name, professional bio and public links are managed in your developer profile so they stay consistent across MAS.</p> : <div className="grid gap-2"><Label htmlFor="bio" className="text-sm">Bio</Label><Textarea id="bio" rows={4} maxLength={300} value={bio ?? profile?.bio ?? ""} onChange={(event) => setBio(event.target.value)} placeholder="A little about yourself…" className="min-h-24 resize-y rounded-xl border-border" /><p className="text-right text-xs text-muted-foreground">{(bio ?? profile?.bio ?? "").length}/300</p></div>}
                <Button className="rounded-full bg-primary px-6 text-primary-foreground hover:opacity-90" disabled={saveProfile.isPending} onClick={() => saveProfile.mutate()}>{saveProfile.isPending ? "Saving…" : "Save profile"}</Button>
              </div>
            </section>
            )}
            {section === "appearance" && (
<section id="appearance" className="scroll-mt-24 rounded-3xl border border-border/70 bg-background/90 p-5 shadow-sm sm:p-7">
              <div className="mb-5"><h2 className="text-xl font-semibold tracking-tight">Appearance</h2><p className="mt-1 text-sm text-muted-foreground">Choose how MAS looks on this device.</p></div>
              <div className="flex items-center justify-between gap-4 rounded-2xl bg-muted/40 p-4"><div className="flex items-start gap-3"><Moon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" /><div><p className="text-sm font-medium">Dark theme</p><p className="mt-1 text-sm text-muted-foreground">Use a darker interface in low light.</p></div></div><Switch aria-label="Toggle dark theme" checked={dark} onCheckedChange={setTheme} /></div>
              <div className="mt-5 flex items-start gap-3"><Palette className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="text-sm font-medium">Accent color</p><p className="mt-1 text-sm leading-5 text-muted-foreground">Customize the highlight color across the store and Developer Mode. Your choice is saved on this device.</p><div className="mt-4 flex flex-wrap gap-2">{ACCENT_PRESETS.map((preset) => <button key={preset.value} type="button" onClick={() => setAccent(preset.value)} aria-label={`Use ${preset.name} accent color`} aria-pressed={accent.toLowerCase() === preset.value.toLowerCase()} title={preset.name} className={`flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${accent.toLowerCase() === preset.value.toLowerCase() ? "border-primary bg-accent" : "border-border hover:bg-muted/60"}`}><span className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: preset.value }} />{preset.name}</button>)}</div><div className="mt-4 flex flex-wrap items-center gap-3"><label className="flex items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm"><span className="text-muted-foreground">Custom color</span><input aria-label="Choose custom accent color" type="color" value={/^#[0-9a-f]{6}$/i.test(accent) ? accent : "#168447"} onChange={(event) => setAccent(event.target.value)} className="h-8 w-10 cursor-pointer border-0 bg-transparent p-0" /></label><span className="font-mono text-xs uppercase text-muted-foreground">{accent}</span></div></div></div>
            </section>
            )}
            {section === "workspace" && (
            <section id="workspace" className="rounded-2xl border border-border/70 bg-background/90 p-4 sm:p-5">
              <div className="mb-4"><h2 className="text-xl font-semibold tracking-tight">Workspace</h2><p className="mt-1 text-sm text-muted-foreground">Choose where you want to work in MAS.</p></div>
              <div className="divide-y divide-border">
                <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3"><Store className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><p className="text-sm font-semibold">Developer Mode</p><p className="mt-1 text-sm text-muted-foreground">{settingsMode === "developer" ? "Open your Developer Console." : "Switch to the developer workspace."}</p></div></div>
                  <Button className="rounded-full bg-primary text-primary-foreground hover:opacity-90" disabled={setMode.isPending} onClick={() => { if (settingsMode === "developer") navigate({ to: "/console", replace: true }); else toggleDeveloper(true); }}>{setMode.isPending ? "Switching…" : settingsMode === "developer" ? "Open Developer Mode" : "Enable Developer Mode"}</Button>
                </div>
                <button type="button" onClick={() => navigate({ to: "/console/social", replace: true })} className="flex w-full items-center gap-3 py-4 text-left hover:text-primary">
                  <MessageCircle className="h-5 w-5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1"><p className="text-sm font-semibold">Social</p><p className="mt-1 text-sm text-muted-foreground">Open the MAS Social space.</p></span>
                </button>
              </div>
            </section>
            )}
            {section === "account" && (
<section id="account" className="scroll-mt-24 rounded-3xl border border-border/70 bg-background/90 p-5 shadow-sm sm:p-7"><div className="mb-4"><h2 className="text-xl font-semibold tracking-tight">Account</h2><p className="mt-1 text-sm text-muted-foreground">Your sign-in details and account access.</p></div><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-sm font-medium">Signed-in email</p><p className="mt-1 break-all text-sm text-muted-foreground">{account.data?.email ?? "Loading account email…"}</p></div><Button variant="outline" className="w-full rounded-full border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive sm:w-auto" disabled={isSigningOut} onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sign out</Button></div></section>
            )}
          </div>
      </main>
      <DeveloperTermsDialog open={termsOpen} onOpenChange={setTermsOpen} pending={setMode.isPending} onAccept={() => setMode.mutate({ next: "developer", acceptTerms: true })} />
    </AppShell>
  );
}

export function ProfileSettingsPage() { return <SettingsPage section="profile" />; }
export function AppearanceSettingsPage() { return <SettingsPage section="appearance" />; }
export function WorkspaceSettingsPage() { return <SettingsPage section="workspace" />; }
export function AccountSettingsPage() { return <SettingsPage section="account" />; }
