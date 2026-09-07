import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy product workspace, now lives in the console. */
export const Route = createFileRoute("/_authenticated/manage/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/console/products/$id", params: { id: params.id }, replace: true });
  },
});
