import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy developer route, now lives in the console. */
export const Route = createFileRoute("/_authenticated/team")({
  beforeLoad: () => {
    throw redirect({ to: "/console/manage", replace: true });
  },
});
