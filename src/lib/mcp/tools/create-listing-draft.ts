import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { supabaseForUser } from "../supabase";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export default defineTool({
  name: "create_listing_draft",
  title: "Create listing draft",
  description:
    "Create a new draft listing owned by the signed-in developer. Drafts are private until submitted for review in the app.",
  inputSchema: {
    name: z.string().trim().min(2).max(80).describe("App or website name."),
    tagline: z.string().trim().max(140).optional().describe("Short one-line pitch."),
    description: z.string().trim().max(4000).optional().describe("Full listing description."),
    category: z.string().trim().min(2).describe("Category, e.g. Education, Finance, Tools."),
    kind: z.enum(["app", "website"]).describe("Whether this listing is an app or a website."),
    website_url: z
      .string()
      .trim()
      .url()
      .optional()
      .describe("Website URL, required for website listings."),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  handler: async ({ name, tagline, description, category, kind, website_url }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabaseForUser(ctx)
      .from("listings")
      .insert({
        developer_id: ctx.getUserId()!,
        slug,
        name,
        tagline: tagline ?? null,
        description: description ?? null,
        category,
        kind,
        website_url: website_url ?? null,
        status: "draft",
      })
      .select("id,slug,name,status")
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { listing: data },
    };
  },
});
