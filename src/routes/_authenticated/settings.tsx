import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { BadgeCheck, LogOut, Moon, Shield } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { DeveloperTermsDialog } from "@/components/DeveloperTerms";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useIsAdmin, useMode, useProfile } from "@/hooks/useSession";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/integrations/supabase/client";
import { SOCIAL_FIELDS, SUBSCRIPTION_PRICE_MWK, formatMwk, uploadAsset } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Malawian App Store" },
      {
        name: "description",
        content:
          "Manage your profile, developer mode, WhatsApp phone verification, KYC badge and MK5,000 monthly publishing subscription.",
      },
      { property: "og:title", content: "Settings — Malawian App Store" },
      { property: "og:description", content: "Profile, developer mode, KYC and subscription." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { userId, profile } = useProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const mode = useMode();
  const isAdmin = useIsAdmin();
  const { dark, setTheme } = useTheme();
  const [socials, setSocials] = useState<Record<string, string>>({});
  const [termsOpen, setTermsOpen] = useState(false);


  const [displayName, setDisplayName] = useState<string | null>(null);
  const [developerName, setDeveloperName] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [sentCode, setSentCode] = useState<string | null>(null);
  const [idDoc, setIdDoc] = useState<File | null>(null);
  const [fullName, setFullName] = useState("");
  const [idType, setIdType] = useState("National ID");
  const [idNumber, setIdNumber] = useState("");

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["profile", userId] });

  const subscription = useQuery({
    queryKey: ["subscription", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName ?? profile?.display_name ?? null,
          developer_name: developerName ?? profile?.developer_name ?? null,
          bio: bio ?? profile?.bio ?? null,
        })
        .eq("id", userId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile saved");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setMode = useMutation({
    mutationFn: async ({ next, acceptTerms }: { next: "developer" | "user"; acceptTerms?: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          mode: next,
          is_developer: next === "developer" ? true : profile?.is_developer ?? false,
          ...(acceptTerms ? { developer_terms_accepted_at: new Date().toISOString() } : {}),
        })
        .eq("id", userId!);
      if (error) throw error;
      return next;
    },
    onSuccess: async (next) => {
      setTermsOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      toast.success(next === "developer" ? "Developer workspace on" : "Back to the store");
      navigate({ to: next === "developer" ? "/dashboard" : "/" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleDeveloper(on: boolean) {
    if (!on) {
      setMode.mutate({ next: "user" });
      return;
    }
    if (!profile?.developer_terms_accepted_at) {
      setTermsOpen(true);
      return;
    }
    setMode.mutate({ next: "developer" });
  }


  const saveSocials = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update(socials as Partial<Record<(typeof SOCIAL_FIELDS)[number]["key"], string>>)
        .eq("id", userId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Social links saved");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const phoneValue = phone ?? profile?.phone ?? "";

  function sendWhatsAppCode() {
    const clean = phoneValue.replace(/[^\d+]/g, "");
    if (clean.replace(/\D/g, "").length < 9) {
      toast.error("Enter your number in international format, e.g. +265991234567");
      return;
    }
    const generated = String(Math.floor(100000 + Math.random() * 900000));
    setSentCode(generated);
    const text = encodeURIComponent(
      `Malawian App Store verification code: ${generated}. Send this message to confirm your number.`,
    );
    window.open(`https://wa.me/${clean.replace(/\D/g, "")}?text=${text}`, "_blank", "noopener");
    toast.info("WhatsApp opened — send the message, then enter the code below.");
  }

  const confirmPhone = useMutation({
    mutationFn: async () => {
      if (!sentCode || code.trim() !== sentCode) throw new Error("That code doesn't match.");
      const { error } = await supabase
        .from("profiles")
        .update({ phone: phoneValue, phone_verified: true })
        .eq("id", userId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Phone number verified");
      setCode("");
      setSentCode(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitKyc = useMutation({
    mutationFn: async () => {
      if (!idDoc) throw new Error("Attach a national ID or passport photo.");
      if (fullName.trim().length < 3) throw new Error("Enter your full legal name.");
      if (idNumber.trim().length < 4) throw new Error("Enter your ID number.");
      const path = await uploadAsset(userId!, idDoc, "kyc", "kyc-docs");
      const { error } = await supabase.from("kyc_submissions").insert({
        user_id: userId!,
        full_name: fullName.trim(),
        id_type: idType,
        id_number: idNumber.trim(),
        document_url: path,
        status: "pending",
      });
      if (error) throw error;
      await supabase.from("profiles").update({ kyc_status: "pending" }).eq("id", userId!);
    },
    onSuccess: () => {
      toast.success("KYC submitted for review");
      setIdDoc(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const startSubscription = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const renews = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const { error } = await supabase.from("subscriptions").upsert(
        {
          user_id: userId!,
          status: "active",
          amount_mwk: SUBSCRIPTION_PRICE_MWK,
          current_period_end: renews.toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Publishing plan activated");
      subscription.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold">Settings</h1>

      <section className="surface-card mt-5 space-y-3 p-4">
        <h2 className="font-display text-base font-semibold">Profile</h2>
        <div>
          <Label htmlFor="display">Display name</Label>
          <Input
            id="display"
            value={displayName ?? profile?.display_name ?? ""}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            rows={3}
            maxLength={300}
            value={bio ?? profile?.bio ?? ""}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>
        <Button size="sm" disabled={saveProfile.isPending} onClick={() => saveProfile.mutate()}>
          Save profile
        </Button>
      </section>

      <section className="surface-card mt-4 space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold">Developer mode</h2>
            <p className="text-xs text-muted-foreground">Switch between shopping and publishing.</p>
          </div>
          <Switch
            aria-label="Switch between user and developer mode"
            checked={mode === "developer"}
            onCheckedChange={(v) => toggleDeveloper(v)}
          />
        </div>
        {profile?.is_developer && (
          <>
            <div>
              <Label htmlFor="devname">Developer / studio name</Label>
              <Input
                id="devname"
                value={developerName ?? profile?.developer_name ?? ""}
                onChange={(e) => setDeveloperName(e.target.value)}
              />
              <Button
                size="sm"
                className="mt-2"
                disabled={saveProfile.isPending}
                onClick={() => saveProfile.mutate()}
              >
                Save
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { to: "/dashboard", label: "Dashboard" },
              ].map((l) => (
                <Button key={l.to} asChild size="sm" variant="outline">
                  <Link to={l.to}>{l.label}</Link>
                </Button>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="surface-card mt-4 space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Moon className="h-4 w-4 text-muted-foreground" />
            <div>
              <h2 className="font-display text-base font-semibold">Dark theme</h2>
              <p className="text-xs text-muted-foreground">Easier on the eyes at night.</p>
            </div>
          </div>
          <Switch aria-label="Toggle dark theme" checked={dark} onCheckedChange={(v) => setTheme(v)} />
        </div>
      </section>

      {isAdmin && (
        <section className="surface-card mt-4 flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-base font-semibold">Admin panel</h2>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/admin">Open</Link>
          </Button>
        </section>
      )}

      {mode === "developer" && (
        <section className="surface-card mt-4 space-y-3 p-4">
          <h2 className="font-display text-base font-semibold">Developer tools</h2>
          <p className="text-xs text-muted-foreground">
            Your public profile, social pages, verification and Developer Pro plan live in the developer
            section.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { to: "/dashboard", label: "Developer dashboard" },
              { to: "/profile", label: "My public profile" },
              { to: "/verification", label: "Verification" },
              { to: "/pro", label: "Developer Pro plan" },
            ].map((l) => (
              <Button key={l.to} asChild size="sm" variant="outline">
                <Link to={l.to}>{l.label}</Link>
              </Button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Plan: {subscription.data?.status === "active" ? `Active · ${formatMwk(SUBSCRIPTION_PRICE_MWK)} monthly` : "Not subscribed"}
          </p>
        </section>
      )}



      <Button variant="outline" className="mt-4 w-full" onClick={signOut}>
        <LogOut className="mr-2 h-4 w-4" /> Sign out
      </Button>

      <DeveloperTermsDialog
        open={termsOpen}
        onOpenChange={setTermsOpen}
        pending={setMode.isPending}
        onAccept={() => setMode.mutate({ next: "developer", acceptTerms: true })}
      />
    </AppShell>

  );
}
