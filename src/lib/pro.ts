/**
 * Developer Pro positioning and Founding Developer programme copy.
 * Pricing is centralised in monetization.ts.
 */
import { supabase } from "@/integrations/supabase/client";
import { DEVELOPER_PRO_MONTHLY_PRICE_MWK } from "@/lib/monetization";

export const PRO_MONTHLY_PRICE_MWK = DEVELOPER_PRO_MONTHLY_PRICE_MWK;
export const PRO_TRIAL_DAYS = 90;
export const PRO_NAME = "Developer Pro";
export const PRO_TAGLINE =
  "Optional professional tools for developers building on the Malawian App Store.";
export const CORE_MESSAGE = "Build locally. Promote locally. Get discovered locally.";
export const CORE_SUPPORT = "An optional monthly toolkit for Malawian developers.";

export const PRO_BENEFITS = [
  { title: "One published listing included", detail: "Developer Pro covers one active published app or product listing." },
  { title: "Additional publishing", detail: "Additional active listings cost MK1,000 per listing per month." },
  { title: "Advanced analytics", detail: "Track product views, installs and growth with detailed reports." },
  { title: "Priority review", detail: "Eligible submissions enter the priority review queue; approval is never guaranteed." },
  { title: "Developer tools", detail: "Access team collaboration, beta testing and advanced product management tools." },
  { title: "Promotion opportunities", detail: "Access promotional tools and consideration for featured placements." },
] as const;

export const PRO_CHECKLIST = [
  "One active published listing included",
  "Additional listings at MK1,000 per listing/month",
  "Advanced analytics and growth reports",
  "Priority review queue",
  "Team collaboration and beta testing tools",
  "Developer promotion opportunities",
] as const;

export const WHY_PRO = [
  { title: "Local Audience", detail: "Build your visibility within a platform designed around Malawi's digital ecosystem." },
  { title: "Kwacha", detail: "Manage publishing and eligible payments with pricing designed around MWK." },
  { title: "Malawi Marketing", detail: "Access promotional tools and opportunities created for Malawian developers." },
] as const;

export const WHY_PRO_CLOSING =
  "Use the tools you need, while keeping basic developer access free.";

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
