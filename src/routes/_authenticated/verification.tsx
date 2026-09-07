import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy developer route, now lives in the console. */
export const Route = createFileRoute("/_authenticated/verification")({
  beforeLoad: () => {
    throw redirect({ to: "/console/verification", replace: true });
  },
});
