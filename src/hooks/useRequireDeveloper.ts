import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useProfile } from "@/hooks/useSession";

/**
 * Console pages are developer-only. Shoppers who land on one are sent back to
 * settings, where the developer toggle lives. We only decide once the profile
 * has actually been fetched, so a slow connection never bounces a developer.
 */
export function useRequireDeveloper() {
  const { profile, isLoading, isFetching, ready } = useProfile();
  const navigate = useNavigate();
  const isDeveloper = profile?.mode === "developer";
  const settled = ready && !isLoading && !isFetching && profile !== null;

  useEffect(() => {
    if (!settled) return;
    if (!isDeveloper) navigate({ to: "/settings", replace: true });
  }, [settled, isDeveloper, navigate]);

  return { isDeveloper, checking: !settled };
}
