import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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

const MIN_SCREENSHOTS = 2;
const MAX_SCREENSHOT_SIZE = 10 * 1024 * 1024;

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({
    meta: [
      { title: "Publish an App, Malawian App Store" },
      {
        name: "description",
        content:
          "Upload your Android app or website listing with an icon, screenshots, description and first version.",
      },
      { property: "og:title", content: "Publish an App, Malawian App Store" },
      {
        property: "og:description",
        content: "Upload your app or website to the Malawian App Store.",
      },
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
  const [screenshots, setScreenshots] = useState<File[]>([]);

  const screenshotPreviews = useMemo(
    () => screenshots.map((screenshot) => ({ file: screenshot, url: URL.createObjectURL(screenshot) })),
    [screenshots],
  );
  useEffect(
    () => () => screenshotPreviews.forEach((preview) => URL.revokeObjectURL(preview.url)),
    [screenshotPreviews],
  );

  const publish = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("You must be signed in.");
      if (name.trim().length < 2) throw new Error("Give your listing a name.");
      if (kind === "website" && !/^https:\/\//i.test(websiteUrl.trim())) {
        throw new Error("Enter a valid website URL starting with https://");
      }
      if (kind !== "website" && !file) {
        throw new Error("Choose the app package before creating this listing.");
      }
      if (screenshots.length < MIN_SCREENSHOTS) {
        throw new Error("Upload at least 2 app screenshots before creating the listing.");
      }
      if (screenshots.some((screenshot) => !screenshot.type.startsWith("image/"))) {
        throw new Error("Screenshots must be image files.");
      }
      if (screenshots.some((screenshot) => screenshot.size <= 0 || screenshot.size > MAX_SCREENSHOT_SIZE)) {
        throw new Error("Each screenshot must be larger than 0 bytes and no larger than 10 MB.");
      }
      if (file && kind !== "website") {
        const ext = file.name.split(".").pop()?.toLowerCase();
        const expectedExt = kind === "app" ? "apk" : "zip";
        if (ext !== expectedExt) {
          throw new Error(kind === "app" ? "Upload an Android APK file." : "Upload a ZIP package.");
        }
        if (file.size <= 0 || file.size > 50 * 1024 * 1024) {
          throw new Error("Package must be larger than 0 bytes and no larger than 50 MB.");
        }
      }

      const iconPath = icon ? await uploadAsset(userId, icon, "icons") : null;
      const screenshotPaths: string[] = [];
      let filePath: string | null = null;
      let listingId: string | null = null;
      try {
        for (const screenshot of screenshots) {
          screenshotPaths.push(await uploadAsset(userId, screenshot, "screenshots"));
        }

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
            screenshots: screenshotPaths,
            website_url: kind === "website" ? websiteUrl.trim() : null,
            status: "draft",
          })
          .select("id,slug")
          .single();
        if (error) throw error;
        listingId = listing.id;

        filePath = kind !== "website" && file ? await uploadAsset(userId, file, "builds") : null;
        const { error: versionError } = await supabase.from("listing_versions").insert({
          listing_id: listing.id,
          version: version.trim() || "1.0.0",
          changelog: "First release",
          file_url: filePath,
          size_bytes: kind !== "website" ? file?.size ?? null : null,
          status: kind === "website" ? "released" : "pending",
        });
        if (versionError) throw versionError;

        if (!profile?.is_developer) {
          await supabase.from("profiles").update({ is_developer: true }).eq("id", userId);
        }
        return listing;
      } catch (error) {
        if (listingId) {
          const { error: listingCleanupError } = await supabase.from("listings").delete().eq("id", listingId);
          if (listingCleanupError) console.warn("Could not clean up a failed draft listing.");
        }
        const paths = [iconPath, ...screenshotPaths, filePath].filter((path): path is string => Boolean(path));
        if (paths.length) {
          const { error: assetCleanupError } = await supabase.storage.from("app-assets").remove(paths);
          if (assetCleanupError) console.warn("Could not clean up uploaded listing assets.");
        }
        throw error;
      }
    },
    onSuccess: (listing) => {
      toast.success("Draft saved. Complete the publishing checklist and submit it for review.");
      queryClient.invalidateQueries({ queryKey: ["my-listings"] });
      queryClient.invalidateQueries({ queryKey: ["listings", "published"] });
      navigate({ to: "/console/products/$id", params: { id: listing.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <ConsoleShell
      title="Publish a listing"
      description="Add your app details, icon and at least 2 preview screenshots. Then complete the publishing checklist and submit it for store review."
      breadcrumbs={[{ label: "Console", to: "/console" }, { label: "Publish a listing" }]}
    >
      <div className="mt-5 space-y-4">
        <div>
          <Label>Type</Label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {PRODUCT_KINDS.map((k) => (
              <Button
                key={k.value}
                type="button"
                variant={kind === k.value ? "default" : "outline"}
                onClick={() => {
                  setKind(k.value);
                  setFile(null);
                }}
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
            <Label htmlFor="file">{kind === "app" ? "Android APK package" : "ZIP package"}</Label>
            <Input
              id="file"
              type="file"
              accept={kind === "app" ? ".apk,application/vnd.android.package-archive" : ".zip,application/zip"}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">Maximum size: 50 MB. App listings require a package file.</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="icon">App icon</Label>
            <Input
              id="icon"
              type="file"
              accept="image/*"
              onChange={(e) => setIcon(e.target.files?.[0] ?? null)}
            />
            <p className="mt-1 text-xs text-muted-foreground">Square image recommended.</p>
          </div>
          <div>
            <Label htmlFor="version">Version</Label>
            <Input id="version" value={version} onChange={(e) => setVersion(e.target.value)} />
          </div>
        </div>

        <section className="rounded-xl border border-border p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <Label htmlFor="screenshots">Preview screenshots</Label>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload at least 2 images showing your app's screens, like a store listing gallery.
              </p>
            </div>
            <span className={screenshots.length >= MIN_SCREENSHOTS ? "text-sm font-medium text-brand-green" : "text-sm font-medium text-muted-foreground"}>
              {screenshots.length} of {MIN_SCREENSHOTS} required
            </span>
          </div>
          <Input
            id="screenshots"
            className="mt-3"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              const selected = Array.from(e.target.files ?? []);
              setScreenshots((current) => [...current, ...selected].slice(0, 8));
              e.currentTarget.value = "";
            }}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            PNG, JPG or WebP images; up to 8 screenshots, 10 MB each.
          </p>
          {screenshotPreviews.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {screenshotPreviews.map((preview, index) => (
                <div key={`${preview.file.name}-${preview.file.lastModified}-${index}`} className="min-w-0">
                  <img
                    src={preview.url}
                    alt={`Preview screenshot ${index + 1}`}
                    className="aspect-[9/16] w-full rounded-lg border border-border object-cover"
                  />
                  <p className="mt-1 truncate text-xs text-muted-foreground">{preview.file.name}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-1 w-full"
                    onClick={() => setScreenshots((current) => current.filter((_, i) => i !== index))}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        <Button
          className="w-full"
          size="lg"
          disabled={publish.isPending}
          onClick={() => publish.mutate()}
        >
          {publish.isPending ? "Creating listing…" : "Create listing"}
        </Button>
      </div>
    </ConsoleShell>
  );
}
