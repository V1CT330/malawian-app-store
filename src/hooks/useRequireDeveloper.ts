import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useProfile } from "@/hooks/useSession";

/**
 * Portal pages are developer-only. Shoppers who land on one are sent back to
 * settings, where the developer toggle lives.
 */
export function useRequireDeveloper() {
  const { profile, isLoading, ready } = useProfile();
  const navigate = useNavigate();
  const isDeveloper = profile?.mode === "developer";

  useEffect(() => {
    if (!ready || isLoading || !profile) return;
    if (!isDeveloper) navigate({ to: "/settings", replace: true });
  }, [ready, isLoading, profile, isDeveloper, navigate]);

  return { isDeveloper, checking: !ready || isLoading || !profile };
}
