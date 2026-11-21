import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceSettingsPage } from "./settings";

export const Route = createFileRoute("/_authenticated/settings/workspace")({
  component: WorkspaceSettingsPage,
});
