import type { PortalListing } from "@/lib/portal";

/** Sidebar information architecture for the developer console. */
export const CONSOLE_NAV = [
  { to: "/console", label: "Dashboard", icon: "dashboard" },
  { to: "/console/products", label: "All products", icon: "products" },
  { to: "/console/publishing", label: "Publishing", icon: "publishing" },
  { to: "/console/testing", label: "Testing", icon: "testing" },
  { to: "/console/quality", label: "Quality", icon: "quality" },
  { to: "/console/analytics", label: "Analytics", icon: "analytics" },
  { to: "/console/reviews", label: "Reviews", icon: "reviews" },
  { to: "/console/store", label: "Store listing", icon: "store" },
  { to: "/console/manage", label: "Manage", icon: "manage" },
  { to: "/console/settings", label: "Settings", icon: "settings" },
] as const;

export type ConsoleNavItem = (typeof CONSOLE_NAV)[number];

export function isWebsite(kind: string | undefined | null) {
  return kind === "website";
}

/** Websites report visits, everything else reports installs. */
export function metricLabel(kind: string | undefined | null, plural = true) {
  if (isWebsite(kind)) return plural ? "visits" : "visit";
  return plural ? "installs" : "install";
}

export function releaseLabel(kind: string | undefined | null, plural = true) {
  if (isWebsite(kind)) return plural ? "deployments" : "deployment";
  return plural ? "releases" : "release";
}

export type Requirement = { label: string; ok: boolean; hint: string };

/**
 * Everything a listing needs before it can be submitted for review.
 * Apps and websites have different requirements.
 */
export function submissionRequirements(l: Partial<PortalListing> | null): Requirement[] {
  if (!l) return [];
  const website = isWebsite(l.kind);
  const base: Requirement[] = [
    {
      label: "Product name",
      ok: (l.name?.trim().length ?? 0) >= 3,
      hint: "At least 3 characters.",
    },
    {
      label: "Short description",
      ok: (l.tagline?.trim().length ?? 0) >= 20,
      hint: "One line, 20 characters or more.",
    },
    {
      label: "Full description",
      ok: (l.description?.trim().length ?? 0) >= 200,
      hint: "200 characters or more helps discovery.",
    },
    { label: "Category", ok: Boolean(l.category), hint: "Pick the closest category." },
    {
      label: website ? "Logo or thumbnail" : "App icon",
      ok: Boolean(l.icon_url),
      hint: "Square image, at least 512px.",
    },
    {
      label: website ? "Preview screenshots" : "Screenshots",
      ok: (l.screenshots?.length ?? 0) >= 2,
      hint: "Add at least 2 images.",
    },
  ];
  if (website) {
    base.push({
      label: "Website address",
      ok: /^https?:\/\/.+\..+/.test(l.website_url ?? ""),
      hint: "Full URL starting with https://",
    });
  }
  return base;
}

export function readinessScore(l: Partial<PortalListing> | null) {
  const reqs = submissionRequirements(l);
  if (reqs.length === 0) return 0;
  return Math.round((reqs.filter((r) => r.ok).length / reqs.length) * 100);
}

export function canSubmit(l: Partial<PortalListing> | null) {
  return submissionRequirements(l).every((r) => r.ok);
}

export const STATUS_HELP: Record<string, string> = {
  draft: "Only you can see this. Complete the checklist, then submit it for review.",
  pending: "The store review team is checking this product. You cannot edit the status while it is in review.",
  published: "Live in the store and visible to everyone.",
  rejected: "The review team asked for changes. Fix the issues, then move it back to draft and resubmit.",
  archived: "Removed from the store. You can move it back to draft at any time.",
};
