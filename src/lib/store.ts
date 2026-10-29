import { supabase } from "@/integrations/supabase/client";
export { CATEGORIES, SUBSCRIPTION_PRICE_MWK, slugify, formatMwk, formatAmount, formatBytes } from "@/shared/mas-core";

export const SOCIAL_LINKS = [
  { label: "Facebook", href: "https://facebook.com/malawianappstore" },
  { label: "WhatsApp", href: "https://wa.me/265999000000" },
  { label: "X", href: "https://x.com/malawianappstore" },
  { label: "TikTok", href: "https://tiktok.com/@malawianappstore" },
];

export type { Listing } from "@/shared/mas-core";
import type { Listing } from "@/shared/mas-core";

/** Buckets are private, so assets are read through short-lived signed URLs. */
export async function signedAssetUrl(path: string | null | undefined, bucket = "app-assets") {
  if (!path) return null;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export async function uploadAsset(
  userId: string,
  file: File,
  folder: string,
  bucket = "app-assets",
) {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${userId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

export const SOCIAL_FIELDS = [
  { key: "website_url", label: "Website", placeholder: "https://example.mw" },
  { key: "facebook_url", label: "Facebook", placeholder: "https://facebook.com/…" },
  { key: "x_url", label: "X (Twitter)", placeholder: "https://x.com/…" },
  { key: "linkedin_url", label: "LinkedIn", placeholder: "https://linkedin.com/in/…" },
  { key: "instagram_url", label: "Instagram", placeholder: "https://instagram.com/…" },
  { key: "youtube_url", label: "YouTube", placeholder: "https://youtube.com/@…" },
  { key: "whatsapp_url", label: "WhatsApp", placeholder: "https://wa.me/265…" },
] as const;

export type SocialKey = (typeof SOCIAL_FIELDS)[number]["key"];

/** Best-effort device + country tags used for developer analytics. */
export function clientContext() {
  if (typeof navigator === "undefined") return { device: null, country: null };
  const ua = navigator.userAgent;
  const device = /Android/i.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/i.test(ua)
      ? "iOS"
      : /Mobile/i.test(ua)
        ? "Mobile"
        : "Desktop";
  let country: string | null = null;
  try {
    country = new Intl.Locale(navigator.language).maximize().region ?? null;
  } catch {
    country = null;
  }
  return { device, country };
}

export function listingUrl(slug: string) {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://malawianappstore.lovable.app";
  return `${origin}/apps/${slug}`;
}

export function qrCodeUrl(value: string, size = 240) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`;
}

export const REPORT_KINDS = [
  "Fake app",
  "Malware / security",
  "Copyright violation",
  "Bug",
  "Content policy",
  "Other",
];
