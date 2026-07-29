import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { signedAssetUrl } from "@/lib/store";

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  phone: string | null;
  phone_verified: boolean;
  is_developer: boolean;
  developer_name: string | null;
  kyc_status: "none" | "pending" | "approved" | "rejected";
};

export function useSession() {
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUserId(data.session?.user.id ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setReady(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { userId, ready };
}

export function useProfile() {
  const { userId, ready } = useSession();
  const query = useQuery({
    queryKey: ["profile", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
  return { userId, ready, profile: query.data ?? null, isLoading: query.isLoading };
}

export function useSignedUrl(path: string | null | undefined, bucket = "app-assets") {
  return useQuery({
    queryKey: ["signed-url", bucket, path],
    enabled: Boolean(path),
    staleTime: 30 * 60 * 1000,
    queryFn: () => signedAssetUrl(path, bucket),
  }).data;
}
