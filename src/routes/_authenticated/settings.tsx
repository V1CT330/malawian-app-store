import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { BadgeCheck, LogOut, Moon, Shield } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
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
    mutationFn: async (next: "developer" | "user") => {
      const { error } = await supabase
        .from("profiles")
        .update({ mode: next, is_developer: next === "developer" ? true : profile?.is_developer ?? false })
        .eq("id", userId!);
      if (error) throw error;
      return next;
    },
    onSuccess: async (next) => {
      await queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      toast.success(next === "developer" ? "Developer workspace on" : "Back to the store");
      navigate({ to: next === "developer" ? "/dashboard" : "/" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
            onCheckedChange={(v) => setMode.mutate(v ? "developer" : "user")}
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
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { to: "/dashboard", label: "Dashboard" },
                { to: "/wallet", label: "Wallet" },
                { to: "/business", label: "Business" },
                { to: "/promote", label: "Promote" },
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

      <section className="surface-card mt-4 space-y-3 p-4">
        <h2 className="font-display text-base font-semibold">Social media pages</h2>
        {SOCIAL_FIELDS.map((f) => (
          <div key={f.key}>
            <Label htmlFor={f.key}>{f.label}</Label>
            <Input
              id={f.key}
              placeholder={f.placeholder}
              value={socials[f.key] ?? (profile?.[f.key] as string | null) ?? ""}
              onChange={(e) => setSocials((prev) => ({ ...prev, [f.key]: e.target.value }))}
            />
          </div>
        ))}
        <Button size="sm" disabled={saveSocials.isPending} onClick={() => saveSocials.mutate()}>
          Save links
        </Button>
      </section>

      <section className="surface-card mt-4 space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">WhatsApp verification</h2>
          {profile?.phone_verified && (
            <Badge className="gap-1">
              <BadgeCheck className="h-3.5 w-3.5" /> Verified
            </Badge>
          )}
        </div>
        <div>
          <Label htmlFor="phone">Phone number</Label>
          <Input
            id="phone"
            value={phoneValue}
            placeholder="+265991234567"
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={sendWhatsAppCode}>
            Send code on WhatsApp
          </Button>
          {sentCode && (
            <>
              <Input
                className="w-32"
                value={code}
                inputMode="numeric"
                maxLength={6}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6-digit code"
              />
              <Button size="sm" onClick={() => confirmPhone.mutate()}>
                Confirm
              </Button>
            </>
          )}
        </div>
      </section>

      <section className="surface-card mt-4 space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">KYC verification badge</h2>
          <Badge variant="secondary" className="capitalize">
            {profile?.kyc_status ?? "none"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Upload a national ID or passport. Documents are stored privately and only reviewed by the store team.
        </p>
        <div>
          <Label htmlFor="fullname">Full legal name</Label>
          <Input id="fullname" value={fullName} maxLength={80} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="idtype">Document type</Label>
            <Input id="idtype" value={idType} onChange={(e) => setIdType(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="idnumber">Document number</Label>
            <Input id="idnumber" value={idNumber} maxLength={40} onChange={(e) => setIdNumber(e.target.value)} />
          </div>
        </div>
        <Input type="file" accept="image/*,application/pdf" onChange={(e) => setIdDoc(e.target.files?.[0] ?? null)} />
        <Button size="sm" disabled={submitKyc.isPending} onClick={() => submitKyc.mutate()}>
          Submit for verification
        </Button>
      </section>

      <section className="surface-card mt-4 space-y-3 p-4">
        <h2 className="font-display text-base font-semibold">Publishing subscription</h2>
        <p className="text-sm text-muted-foreground">
          {formatMwk(SUBSCRIPTION_PRICE_MWK)} per month to keep your listings live.
        </p>
        {subscription.data?.status === "active" ? (
          <p className="text-sm">
            Active · renews{" "}
            {subscription.data.current_period_end
              ? new Date(subscription.data.current_period_end).toLocaleDateString()
              : "monthly"}
          </p>
        ) : (
          <Button size="sm" disabled={startSubscription.isPending} onClick={() => startSubscription.mutate()}>
            Activate plan
          </Button>
        )}
      </section>

      <Button variant="outline" className="mt-4 w-full" onClick={signOut}>
        <LogOut className="mr-2 h-4 w-4" /> Sign out
      </Button>
    </AppShell>
  );
}
