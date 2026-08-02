import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_apps",
  title: "Search apps",
  description: "Search published apps and websites on the Malawian App Store by name, category or kind.",
  inputSchema: {
    query: z.string().trim().optional().describe("Text to match against app name or tagline."),
    category: z.string().trim().optional().describe("Category filter, e.g. Education, Finance."),
    kind: z.enum(["app", "website"]).optional().describe("Limit to apps or websites."),
    limit: z.number().int().min(1).max(50).optional().describe("Maximum results (default 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, category, kind, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let request = supabaseForUser(ctx)
      .from("listings")
      .select("id,slug,name,tagline,category,kind,downloads,rating_avg,rating_count,website_url")
      .eq("status", "published")
      .order("downloads", { ascending: false })
      .limit(limit ?? 10);

    if (category) request = request.eq("category", category);
    if (kind) request = request.eq("kind", kind);
    if (query) request = request.or(`name.ilike.%${query}%,tagline.ilike.%${query}%`);

    const { data, error } = await request;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { apps: data ?? [] },
    };
  },
});
