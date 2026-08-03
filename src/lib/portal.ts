import { supabase } from "@/integrations/supabase/client";

export const PRODUCT_KINDS = [
  { value: "app", label: "App" },
  { value: "website", label: "Website" },
  { value: "ai_agent", label: "AI agent" },
  { value: "extension", label: "Browser extension" },
] as const;

export type ProductKind = (typeof PRODUCT_KINDS)[number]["value"];

export const PRODUCT_STATUSES = ["draft", "pending", "published", "rejected", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const TEAM_ROLES = [
  { value: "admin", label: "Admin", hint: "Manage products, versions and team" },
  { value: "editor", label: "Editor", hint: "Edit listings and ship versions" },
  { value: "viewer", label: "Viewer", hint: "Read-only access to analytics" },
] as const;

export function kindLabel(kind: string) {
  return PRODUCT_KINDS.find((k) => k.value === kind)?.label ?? "App";
}

export type PortalListing = {
  id: string;
  developer_id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  category: string;
  kind: string;
  status: string;
  icon_url: string | null;
  banner_url: string | null;
  video_url: string | null;
  website_url: string | null;
  screenshots: string[];
  promo_images: string[];
  tags: string[];
  keywords: string[];
  seo_score: number;
  quality_score: number;
  featured: boolean;
  rejection_reason: string | null;
  downloads: number;
  rating_avg: number;
  rating_count: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PortalVersion = {
  id: string;
  listing_id: string;
  version: string;
  changelog: string | null;
  release_notes: string | null;
  channel: string;
  status: string;
  is_current: boolean;
  scheduled_at: string | null;
  file_url: string | null;
  size_bytes: number | null;
  created_at: string;
};

/** Store-optimisation scoring used by the ASO panel. Pure, so it renders instantly. */
export function asoReport(l: Partial<PortalListing>) {
  const checks = [
    { label: "Name between 3 and 30 characters", ok: (l.name?.length ?? 0) >= 3 && (l.name?.length ?? 0) <= 30, weight: 10 },
    { label: "Tagline written (40+ characters)", ok: (l.tagline?.length ?? 0) >= 40, weight: 10 },
    { label: "Description of 200+ characters", ok: (l.description?.length ?? 0) >= 200, weight: 20 },
    { label: "Icon uploaded", ok: Boolean(l.icon_url), weight: 15 },
    { label: "At least 3 screenshots", ok: (l.screenshots?.length ?? 0) >= 3, weight: 15 },
    { label: "Feature banner uploaded", ok: Boolean(l.banner_url), weight: 5 },
    { label: "5 or more keywords", ok: (l.keywords?.length ?? 0) >= 5, weight: 15 },
    { label: "3 or more tags", ok: (l.tags?.length ?? 0) >= 3, weight: 10 },
  ];
  const score = checks.reduce((sum, c) => sum + (c.ok ? c.weight : 0), 0);
  return { score, checks, missing: checks.filter((c) => !c.ok).map((c) => c.label) };
}

export function visibilityScore(l: Partial<PortalListing>, reputation: number) {
  const aso = asoReport(l).score;
  const rating = (l.rating_avg ?? 0) * 8;
  const traction = Math.min(20, Math.round((l.downloads ?? 0) / 5));
  return Math.min(100, Math.round(aso * 0.5 + rating + traction + reputation * 0.2));
}

export function scoreTone(score: number) {
  if (score >= 75) return "text-brand-green";
  if (score >= 45) return "text-foreground";
  return "text-destructive";
}

/** Writes to the shared team activity log. Never throws into the UI path. */
export async function logActivity(input: {
  ownerId: string;
  actorId: string;
  action: string;
  target?: string | null;
  listingId?: string | null;
}) {
  try {
    await supabase.from("activity_logs").insert({
      owner_id: input.ownerId,
      actor_id: input.actorId,
      action: input.action,
      target: input.target ?? null,
      listing_id: input.listingId ?? null,
    });
  } catch {
    /* logging must never break the action */
  }
}

export async function fetchReputation(developerId: string) {
  const { data, error } = await supabase.rpc("compute_reputation", { _developer: developerId });
  if (error) throw error;
  return Number(data ?? 0);
}

export function reputationTier(score: number) {
  if (score >= 80) return "Elite";
  if (score >= 60) return "Trusted";
  if (score >= 35) return "Rising";
  return "New";
}

export const SUBSCRIPTION_BENEFITS = [
  "Verified developer badge",
  "Unlimited product uploads",
  "Priority review queue",
  "Advanced analytics",
  "AI publishing assistant",
  "Featured developer profile",
  "Beta testing tools",
  "Team collaboration",
  "Priority support",
  "Early access to new platform features",
];
