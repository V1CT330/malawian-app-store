import { createFileRoute } from "@tanstack/react-router";
import { AccountSettingsPage } from "./settings";

export const Route = createFileRoute("/_authenticated/settings/account")({
  component: AccountSettingsPage,
});
