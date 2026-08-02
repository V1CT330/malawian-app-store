import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_app",
  title: "Get app details",
  description: "Fetch full details, latest versions and recent reviews for one published app by its slug.",
  inputSchema: { slug: z.string().trim().min(1).describe("The app slug, e.g. mzuni-notes.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data: listing, error } = await supabase
      .from("listings")
      .select("id,slug,name,tagline,description,category,kind,website_url,downloads,rating_avg,rating_count,status")
      .eq("slug", slug)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!listing) return { content: [{ type: "text", text: `No app found for slug "${slug}"` }], isError: true };

    const [{ data: versions }, { data: reviews }] = await Promise.all([
      supabase
        .from("listing_versions")
        .select("version,changelog,size_bytes,created_at")
        .eq("listing_id", listing.id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("reviews")
        .select("rating,body,created_at")
        .eq("listing_id", listing.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const payload = { listing, versions: versions ?? [], reviews: reviews ?? [] };
    return { content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload };
  },
});
