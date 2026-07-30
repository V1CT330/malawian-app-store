import { supabase } from "@/integrations/supabase/client";

export const CATEGORIES = [
  "Business",
  "Education",
  "Entertainment",
  "Finance",
  "Health",
  "News",
  "Shopping",
  "Social",
  "Tools",
  "Transport",
  "Other",
] as const;

export const SUBSCRIPTION_PRICE_MWK = 5000;

export const SOCIAL_LINKS = [
  { label: "Facebook", href: "https://facebook.com/malawianappstore" },
  { label: "WhatsApp", href: "https://wa.me/265999000000" },
  { label: "X", href: "https://x.com/malawianappstore" },
  { label: "TikTok", href: "https://tiktok.com/@malawianappstore" },
];

export type Listing = {
  id: string;
  developer_id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  category: string;
  kind: "app" | "website";
  icon_url: string | null;
  screenshots: string[];
  website_url: string | null;
  price_mwk: number;
  status: "draft" | "pending" | "published" | "rejected";
  featured?: boolean;
  rejection_reason?: string | null;
  downloads: number;
  rating_avg: number;
  rating_count: number;
  created_at: string;
  updated_at: string;
};

export function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "listing"
  );
}

export function formatMwk(amount: number) {
  return amount === 0 ? "Free" : `MK${amount.toLocaleString("en-MW")}`;
}

export function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

/** Buckets are private, so assets are read through short-lived signed URLs. */
export async function signedAssetUrl(path: string | null | undefined, bucket = "app-assets") {
  if (!path) return null;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export async function uploadAsset(userId: string, file: File, folder: string, bucket = "app-assets") {
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
  const origin = typeof window !== "undefined" ? window.location.origin : "https://malawianappstore.lovable.app";
  return `${origin}/apps/${slug}`;
}

export function qrCodeUrl(value: string, size = 240) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`;
}

export const REPORT_KINDS = ["Fake app", "Malware / security", "Copyright violation", "Bug", "Content policy", "Other"];
