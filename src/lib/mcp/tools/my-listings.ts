import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "my_listings",
  title: "My listings",
  description: "List the signed-in developer's own listings with status, installs and ratings.",
  inputSchema: {
    status: z.enum(["draft", "pending", "published", "rejected"]).optional().describe("Filter by status."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let request = supabaseForUser(ctx)
      .from("listings")
      .select("id,slug,name,tagline,category,kind,status,rejection_reason,downloads,rating_avg,rating_count,updated_at")
      .eq("developer_id", ctx.getUserId()!)
      .order("updated_at", { ascending: false });
    if (status) request = request.eq("status", status);

    const { data, error } = await request;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { listings: data ?? [] },
    };
  },
});
