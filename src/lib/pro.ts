/**
 * Developer Pro positioning and Founding Developer programme copy.
 * Kept in one place so the developer section stays consistent.
 */
import { supabase } from "@/integrations/supabase/client";

export const PRO_PRICE_MWK = 5000;
export const PRO_NAME = "Developer Pro";
export const PRO_TAGLINE = "The professional toolkit for developers building Malawi's digital future.";
export const CORE_MESSAGE = "Build locally. Promote locally. Get discovered locally.";
export const CORE_SUPPORT = "One professional toolkit for Malawian developers.";

export const PRO_BENEFITS = [
  { title: "Publish", detail: "Publish unlimited eligible apps and websites." },
  { title: "Promote", detail: "Advertise your products within the ecosystem." },
  {
    title: "Get Featured",
    detail: "Priority consideration for Developer Spotlight and promotional opportunities.",
  },
  { title: "Analytics", detail: "Track product views, downloads and growth." },
  { title: "MWK Payments", detail: "Support eligible local developer payments." },
  { title: "Get Verified", detail: "Build trust with a Verified Developer badge." },
] as const;

export const PRO_CHECKLIST = [
  "Publish unlimited eligible products",
  "Promote your products",
  "Analytics and Growth Dashboard",
  "Priority Spotlight consideration",
  "Local MWK payment support",
  "Verified Developer badge",
] as const;

export const WHY_PRO = [
  {
    title: "Local Audience",
    detail: "Build your visibility within a platform designed around Malawi's digital ecosystem.",
  },
  {
    title: "Kwacha",
    detail: "Build and promote products with pricing and eligible payments designed around MWK.",
  },
  {
    title: "Malawi Marketing",
    detail: "Access promotional tools and opportunities created specifically for Malawian developers.",
  },
] as const;

export const WHY_PRO_CLOSING =
  "You're not just publishing an app. You're building your presence in Malawi's technology ecosystem.";

export const FOUNDING_HEADLINE = "Founding Developer Program";
export const FOUNDING_LEAD =
  "You're early. Build your presence before the next generation of Malawian users arrives.";
export const FOUNDING_SUPPORT =
  "The consumer store is already being prepared for launch. Founding developers get priority consideration for placement and future promotional opportunities.";
export const FOUNDING_PRIORITY_NOTE =
  "Founding developers receive priority consideration for future store placement.";

export const SPOTLIGHT_OPPORTUNITIES = [
  { title: "App Spotlight", detail: "A single product highlighted across the store surfaces." },
  { title: "Developer Spotlight", detail: "Your studio profile featured to the community." },
  { title: "Project Spotlight", detail: "Work in progress shared with early adopters." },
  { title: "Podcast Feature", detail: "Selected developers invited to talk about their work." },
  { title: "Made in Malawi Feature", detail: "Products celebrating local problem solving." },
] as const;

export const SPOTLIGHT_NOTE =
  "Verified developers receive priority consideration for Spotlight and promotional opportunities.";

export type FoundingProgram = {
  enabled: boolean;
  promo_credit_mwk: number;
  note: string;
};

/** Founding promotional credit, configurable by admins in platform settings. */
export async function fetchFoundingProgram(): Promise<FoundingProgram> {
  const { data, error } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "founding_program")
    .maybeSingle();
  if (error) throw error;
  const value = (data?.value ?? {}) as Partial<FoundingProgram>;
  return {
    enabled: value.enabled ?? false,
    promo_credit_mwk: Number(value.promo_credit_mwk ?? 0),
    note: value.note ?? "Founding Developer promotional credits",
  };
}
