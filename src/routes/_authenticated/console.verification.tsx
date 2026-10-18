import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, ExternalLink, Save, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConsoleShell } from "@/components/console/ConsoleShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/hooks/useSession";
import { useRequireDeveloper } from "@/hooks/useRequireDeveloper";
import { supabase } from "@/integrations/supabase/client";
import { uploadAsset } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/console/verification")({
  head: () => ({
    meta: [
      { title: "Developer verification · Malawian App Store" },
      {
        name: "description",
        content:
          "Save your WhatsApp contact number and verify your identity manually or securely through Didit.",
      },
      { property: "og:title", content: "Developer verification · Malawian App Store" },
      { property: "og:description", content: "Earn the Verified Developer badge and build trust." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerificationPage,
});

function VerificationPage() {
  useRequireDeveloper();
  const { userId, profile } = useProfile();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["profile", userId] });

  const [phone, setPhone] = useState<string | null>(null);
  const [idDoc, setIdDoc] = useState<File | null>(null);
  const [fullName, setFullName] = useState("");
  const [idType, setIdType] = useState("National ID");
  const [idNumber, setIdNumber] = useState("");

  const phoneValue = phone ?? profile?.phone ?? "";

  const savePhone = useMutation({
    mutationFn: async () => {
      const normalized = phoneValue.trim();
      if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
        throw new Error("Enter a valid number in international format, for example +265991234567.");
      }
      const { error } = await supabase
        .from("profiles")
        .update({ phone: normalized })
        .eq("id", userId!);
      if (error) throw error;
      return normalized;
    },
    onSuccess: (normalized) => {
      setPhone(normalized);
      toast.success("WhatsApp contact number saved");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitKyc = useMutation({
    mutationFn: async () => {
      if (!idDoc) throw new Error("Attach a national ID or passport photo.");
      if (fullName.trim().length < 3) throw new Error("Enter your full legal name.");
      if (idNumber.trim().length < 4) throw new Error("Enter your document number.");
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
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ kyc_status: "pending" })
        .eq("id", userId!);
      if (profileError) throw profileError;
    },
    onSuccess: () => {
      toast.success("Verification submitted for manual review");
      setIdDoc(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startDidit = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("Your session has expired. Sign in again and retry.");

      const response = await fetch("/api/public/didit/session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const result = (await response.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || "Could not start Didit verification. Please try again.");
      }
      if (!result.url) throw new Error("Didit did not return a verification link.");
      const verificationUrl = new URL(result.url);
      if (
        verificationUrl.protocol !== "https:" ||
        !(verificationUrl.hostname === "verify.didit.me" ||
          verificationUrl.hostname.endsWith(".didit.me"))
      ) {
        throw new Error("Didit returned an unexpected verification link. Please contact support.");
      }
      return verificationUrl.toString();
    },
    onSuccess: (url) => {
      toast.info("Opening Didit secure identity verification…");
      window.location.assign(url);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <ConsoleShell title="Verification">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Verification</h1>
          <p className="text-sm text-muted-foreground">
            Verified developers earn user trust and priority Spotlight consideration.
          </p>
        </div>
        {profile?.kyc_status === "approved" ? (
          <Badge className="gap-1">
            <BadgeCheck className="h-3.5 w-3.5" /> Verified
          </Badge>
        ) : (
          <Badge variant="secondary" className="capitalize">
            {profile?.kyc_status ?? "none"}
          </Badge>
        )}
      </div>

      <section className="surface-card space-y-3 p-4">
        <h2 className="font-display text-base font-semibold">WhatsApp number</h2>
        <p className="text-xs text-muted-foreground">
          Save your contact number. This is contact information only and does not verify your identity.
        </p>
        <div>
          <Label htmlFor="phone">Phone number</Label>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            value={phoneValue}
            placeholder="+265991234567"
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={savePhone.isPending || !userId}
          onClick={() => savePhone.mutate()}
        >
          <Save className="mr-2 h-4 w-4" />
          {savePhone.isPending ? "Saving…" : "Save number"}
        </Button>
      </section>

      <section className="surface-card mt-4 space-y-3 p-4">
        <h2 className="font-display text-base font-semibold">Identity documents</h2>
        <p className="text-xs text-muted-foreground">
          Choose manual review by the MAS team or automatic identity verification through Didit.
        </p>
        <div>
          <Label htmlFor="fullname">Full legal name</Label>
          <Input
            id="fullname"
            value={fullName}
            maxLength={80}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="idtype">Document type</Label>
            <Input
              id="idtype"
              value={idType}
              onChange={(e) => setIdType(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="idnumber">Document number</Label>
            <Input
              id="idnumber"
              value={idNumber}
              maxLength={40}
              onChange={(e) => setIdNumber(e.target.value)}
            />
          </div>
        </div>
        <Input
          aria-label="Upload national ID or passport for manual review"
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => setIdDoc(e.target.files?.[0] ?? null)}
        />
        <p className="text-xs text-muted-foreground">
          These details and the uploaded document are used for manual review. Didit collects the
          information required by its own hosted workflow when you choose automatic verification.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            className="w-full sm:flex-1"
            disabled={submitKyc.isPending || !userId}
            onClick={() => submitKyc.mutate()}
          >
            {submitKyc.isPending ? "Submitting…" : "Submit for verification"}
          </Button>
          <Button
            className="w-full sm:flex-1"
            variant="outline"
            disabled={startDidit.isPending || !userId}
            onClick={() => startDidit.mutate()}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            {startDidit.isPending ? "Preparing Didit…" : "Verify automatically with Didit"}
            {!startDidit.isPending && <ExternalLink className="ml-2 h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Automatic verification opens Didit in a secure page. Your MAS status changes only after
          the verification result is received and validated.
        </p>
      </section>

      <section className="surface-card mt-4 p-4">
        <h2 className="font-display text-base font-semibold">Why verification matters</h2>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          <li>Users trust products from verified studios.</li>
          <li>Verified developers get priority Spotlight consideration.</li>
          <li>Verification is required for eligible local payment support.</li>
        </ul>
      </section>
    </ConsoleShell>
  );
}
