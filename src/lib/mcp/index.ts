import { auth, defineMcp } from "@lovable.dev/mcp-js";

import createListingDraftTool from "./tools/create-listing-draft";
import getAppTool from "./tools/get-app";
import myListingsTool from "./tools/my-listings";
import myNotificationsTool from "./tools/my-notifications";
import searchAppsTool from "./tools/search-apps";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "malawian-app-store",
  title: "Malawian App Store",
  version: "0.1.0",
  instructions:
    "Tools for the Malawian App Store. Search and inspect published apps and websites, review the signed-in developer's own listings and notifications, and create new draft listings. All actions run as the signed-in user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchAppsTool, getAppTool, myListingsTool, myNotificationsTool, createListingDraftTool],
});
