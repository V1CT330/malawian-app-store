import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { ConsoleShell } from "@/components/console/ConsoleShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProfile, useSignedUrl } from "@/hooks/useSession";
import { useRequireDeveloper } from "@/hooks/useRequireDeveloper";
import { supabase } from "@/integrations/supabase/client";
import { SOCIAL_FIELDS, uploadAsset } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/console/store")({
  head: () => ({
    meta: [
      { title: "Developer profile · Malawian App Store" },
      {
        name: "description",
        content:
          "Edit your public developer profile: studio name, professional bio, skills, location, contact details and social pages.",
      },
      { property: "og:title", content: "Developer profile · Malawian App Store" },
      { property: "og:description", content: "Your public presence on the Malawian App Store." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DeveloperProfilePage,
});

function DeveloperProfilePage() {
  useRequireDeveloper();
  const { userId, profile } = useProfile();
  const queryClient = useQueryClient();
  const avatar = useSignedUrl(profile?.avatar_url);

  const [fields, setFields] = useState<Record<string, string>>({});
  const [socials, setSocials] = useState<Record<string, string>>({});

  const value = (key: string, fallback: string | null | undefined) =>
    fields[key] ?? fallback ?? "";

  const extra = useQuery({
    queryKey: ["profile-extra", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("company_name,location,contact_email,skills,github_url,portfolio_url,website_url,follower_count")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const views = useQuery({
    queryKey: ["profile-views", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("profile_views")
        .select("id", { count: "exact", head: true })
        .eq("developer_id", userId!);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const skills = (fields["skills"] ?? (extra.data?.skills ?? []).join(", "))
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const { error } = await supabase
        .from("profiles")
        .update({
          developer_name: value("developer_name", profile?.developer_name),
          company_name: value("company_name", extra.data?.company_name),
          bio: value("bio", profile?.bio),
          location: value("location", extra.data?.location),
          contact_email: value("contact_email", extra.data?.contact_email),
          website_url: value("website_url", extra.data?.website_url),
          github_url: value("github_url", extra.data?.github_url),
          portfolio_url: value("portfolio_url", extra.data?.portfolio_url),
          skills,
        })
        .eq("id", userId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile saved");
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      extra.refetch();
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
      toast.success("Social pages saved");
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      const path = await uploadAsset(userId!, file, "avatars");
      const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", userId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile photo updated");
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const text = (key: string, label: string, fallback: string | null | undefined, placeholder = "") => (
    <div>
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        placeholder={placeholder}
        value={value(key, fallback)}
        onChange={(e) => setFields((p) => ({ ...p, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <ConsoleShell title="Store listing">
      <h1 className="font-display text-2xl font-bold">My profile</h1>
      <p className="text-sm text-muted-foreground">
        This is what users see when they open your developer page.
      </p>

      <section className="surface-card flex items-center gap-4 p-4">
        <div className="h-16 w-16 overflow-hidden rounded-full bg-secondary">
          {avatar && <img src={avatar} alt="Your profile photo" className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {profile?.developer_name || profile?.display_name || "Your studio"}
          </p>
          <p className="text-xs text-muted-foreground">
            {views.data ?? 0} profile views · {extra.data?.follower_count ?? 0} followers
          </p>
          <Input
            type="file"
            accept="image/*"
            className="mt-2"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadAvatar.mutate(file);
            }}
          />
        </div>
      </section>

      <section className="surface-card mt-4 space-y-3 p-4">
        <h2 className="font-display text-base font-semibold">Professional details</h2>
        {text("developer_name", "Developer or studio name", profile?.developer_name, "Chikondi Labs")}
        {text("company_name", "Registered company", extra.data?.company_name, "Optional")}
        <div>
          <Label htmlFor="bio">Professional bio</Label>
          <Textarea
            id="bio"
            rows={4}
            maxLength={600}
            value={value("bio", profile?.bio)}
            placeholder="What you build, who you build it for, and the problems you solve."
            onChange={(e) => setFields((p) => ({ ...p, bio: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="skills">Skills</Label>
          <Input
            id="skills"
            placeholder="Flutter, Supabase, payments, USSD"
            value={fields["skills"] ?? (extra.data?.skills ?? []).join(", ")}
            onChange={(e) => setFields((p) => ({ ...p, skills: e.target.value }))}
          />
          <p className="mt-1 text-xs text-muted-foreground">Separate each skill with a comma.</p>
        </div>
        {text("location", "Location", extra.data?.location, "Lilongwe, Malawi")}
        {text("contact_email", "Contact email", extra.data?.contact_email, "you@example.com")}
        {text("website_url", "Website", extra.data?.website_url, "https://")}
        {text("github_url", "GitHub", extra.data?.github_url, "https://github.com/")}
        {text("portfolio_url", "Portfolio", extra.data?.portfolio_url, "https://")}
        <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
          Save profile
        </Button>
      </section>

      <section className="surface-card mt-4 space-y-3 p-4">
        <h2 className="font-display text-base font-semibold">Social pages</h2>
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
          Save social pages
        </Button>
      </section>

      {userId && (
        <Button asChild variant="outline" className="mt-4 w-full">
          <Link to="/developers/$id" params={{ id: userId }}>
            View my public page
          </Link>
        </Button>
      )}
    </ConsoleShell>
  );
}
