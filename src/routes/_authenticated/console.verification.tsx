import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck } from "lucide-react";
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
          "Verify your WhatsApp number and submit your national ID or passport to earn the Verified Developer badge.",
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
  const [code, setCode] = useState("");
  const [sentCode, setSentCode] = useState<string | null>(null);
  const [idDoc, setIdDoc] = useState<File | null>(null);
  const [fullName, setFullName] = useState("");
  const [idType, setIdType] = useState("National ID");
  const [idNumber, setIdNumber] = useState("");

  const phoneValue = phone ?? profile?.phone ?? "";

  function sendWhatsAppCode() {
    const digits = phoneValue.replace(/\D/g, "");
    if (digits.length < 9) {
      toast.error("Enter your number in international format, for example +265991234567");
      return;
    }
    const generated = String(Math.floor(100000 + Math.random() * 900000));
    setSentCode(generated);
    const text = encodeURIComponent(
      `Malawian App Store verification code: ${generated}. Send this message to confirm your number.`,
    );
    window.open(`https://wa.me/${digits}?text=${text}`, "_blank", "noopener");
    toast.info("WhatsApp opened. Send the message, then enter the code below.");
  }

  const confirmPhone = useMutation({
    mutationFn: async () => {
      if (!sentCode || code.trim() !== sentCode) throw new Error("That code does not match.");
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
      await supabase.from("profiles").update({ kyc_status: "pending" }).eq("id", userId!);
    },
    onSuccess: () => {
      toast.success("Verification submitted for review");
      setIdDoc(null);
      refresh();
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
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">WhatsApp number</h2>
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
                placeholder="6 digit code"
              />
              <Button size="sm" onClick={() => confirmPhone.mutate()}>
                Confirm
              </Button>
            </>
          )}
        </div>
      </section>

      <section className="surface-card mt-4 space-y-3 p-4">
        <h2 className="font-display text-base font-semibold">Identity documents</h2>
        <p className="text-xs text-muted-foreground">
          Upload a national ID or passport. Documents are stored privately and reviewed only by the store team.
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
        <Input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => setIdDoc(e.target.files?.[0] ?? null)}
        />
        <Button size="sm" disabled={submitKyc.isPending} onClick={() => submitKyc.mutate()}>
          Submit for verification
        </Button>
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
