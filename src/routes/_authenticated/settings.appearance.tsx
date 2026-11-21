import { createFileRoute } from "@tanstack/react-router";
import { AppearanceSettingsPage } from "./settings";

export const Route = createFileRoute("/_authenticated/settings/appearance")({
  component: AppearanceSettingsPage,
});
