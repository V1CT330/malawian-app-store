import { createFileRoute } from "@tanstack/react-router";
import { ProfileSettingsPage } from "./settings";

export const Route = createFileRoute("/_authenticated/settings/profile")({
  component: ProfileSettingsPage,
});
