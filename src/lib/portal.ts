import { supabase } from "@/integrations/supabase/client";
export { asoReport, reputationTier, visibilityScore } from "@/shared/mas-core";

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
  { value: "viewer", label: "Viewer", hint: "Read only access to analytics" },
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
