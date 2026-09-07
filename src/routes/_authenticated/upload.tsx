import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { ConsoleShell } from "@/components/console/ConsoleShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCT_KINDS, type ProductKind } from "@/lib/portal";
import { CATEGORIES, slugify, uploadAsset } from "@/lib/store";
import { useRequireDeveloper } from "@/hooks/useRequireDeveloper";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({
    meta: [
      { title: "Publish an App — Malawian App Store" },
      {
        name: "description",
        content: "Upload your Android app or website listing with an icon, description and first version.",
      },
      { property: "og:title", content: "Publish an App — Malawian App Store" },
      { property: "og:description", content: "Upload your app or website to the Malawian App Store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UploadPage,
});

function UploadPage() {
  useRequireDeveloper();
  const { userId, profile } = useProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [kind, setKind] = useState<ProductKind>("app");
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [icon, setIcon] = useState<File | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const publish = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("You must be signed in.");
      if (name.trim().length < 2) throw new Error("Give your listing a name.");
      if (kind === "website" && !/^https?:\/\//i.test(websiteUrl.trim())) {
        throw new Error("Enter a valid website URL starting with https://");
      }

      const iconPath = icon ? await uploadAsset(userId, icon, "icons") : null;
      const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;

      const { data: listing, error } = await supabase
        .from("listings")
        .insert({
          developer_id: userId,
          slug,
          name: name.trim(),
          tagline: tagline.trim() || null,
          description: description.trim() || null,
          category,
          kind,
          icon_url: iconPath,
          website_url: kind === "website" ? websiteUrl.trim() : null,
          status: "published",
        })
        .select("id,slug")
        .single();
      if (error) throw error;

      const filePath = file ? await uploadAsset(userId, file, "builds") : null;
      const { error: versionError } = await supabase.from("listing_versions").insert({
        listing_id: listing.id,
        version: version.trim() || "1.0.0",
        changelog: "First release",
        file_url: filePath,
        size_bytes: file?.size ?? null,
      });
      if (versionError) throw versionError;

      if (!profile?.is_developer) {
        await supabase.from("profiles").update({ is_developer: true }).eq("id", userId);
      }
      return listing;
    },
    onSuccess: (listing) => {
      toast.success("Listing published");
      queryClient.invalidateQueries({ queryKey: ["my-listings"] });
      queryClient.invalidateQueries({ queryKey: ["listings", "published"] });
      navigate({ to: "/apps/$slug", params: { slug: listing.slug } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold">Publish a listing</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Apps and websites are reviewed by the store team after publishing.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <Label>Type</Label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {PRODUCT_KINDS.map((k) => (
              <Button
                key={k.value}
                type="button"
                variant={kind === k.value ? "default" : "outline"}
                onClick={() => setKind(k.value)}
                className="flex-1"
              >
                {k.label}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <Label htmlFor="tagline">Tagline</Label>
          <Input
            id="tagline"
            value={tagline}
            maxLength={90}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="One line about your app"
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            maxLength={2000}
            rows={5}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {kind === "website" ? (
          <div>
            <Label htmlFor="url">Website URL</Label>
            <Input
              id="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.mw"
            />
          </div>
        ) : (
          <div>
            <Label htmlFor="file">App file (APK or ZIP)</Label>
            <Input id="file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="icon">Icon</Label>
            <Input
              id="icon"
              type="file"
              accept="image/*"
              onChange={(e) => setIcon(e.target.files?.[0] ?? null)}
            />
          </div>
          <div>
            <Label htmlFor="version">Version</Label>
            <Input id="version" value={version} onChange={(e) => setVersion(e.target.value)} />
          </div>
        </div>

        <Button
          className="w-full"
          size="lg"
          disabled={publish.isPending}
          onClick={() => publish.mutate()}
        >
          {publish.isPending ? "Publishing…" : "Publish listing"}
        </Button>
      </div>
    </AppShell>
  );
}
