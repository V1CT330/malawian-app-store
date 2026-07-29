import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BadgeCheck, LogOut } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { SUBSCRIPTION_PRICE_MWK, formatMwk, uploadAsset } from "@/lib/store";

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

  const toggleDeveloper = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase.from("profiles").update({ is_developer: next }).eq("id", userId!);
      if (error) throw error;
    },
    onSuccess: () => refresh(),
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
      const path = await uploadAsset(userId!, idDoc, "kyc", "kyc-docs");
      const { error } = await supabase
        .from("kyc_submissions")
        .insert({ user_id: userId!, document_url: path, status: "pending" });
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
            checked={Boolean(profile?.is_developer)}
            onCheckedChange={(v) => toggleDeveloper.mutate(v)}
          />
        </div>
        {profile?.is_developer && (
          <div>
            <Label htmlFor="devname">Developer / studio name</Label>
            <Input
              id="devname"
              value={developerName ?? profile?.developer_name ?? ""}
              onChange={(e) => setDeveloperName(e.target.value)}
            />
          </div>
        )}
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
