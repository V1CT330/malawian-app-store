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
  mode: string;
  suspended: boolean;
  website_url: string | null;
  facebook_url: string | null;
  x_url: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  whatsapp_url: string | null;
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

/** True when the signed-in account holds the admin role. */
export function useIsAdmin() {
  const { userId } = useSession();
  const query = useQuery({
    queryKey: ["is-admin", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!)
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
  });
  return query.data ?? false;
}

/** "developer" or "user" — drives which workspace the app renders. */
export function useMode() {
  const { profile } = useProfile();
  return profile?.mode === "developer" ? "developer" : "user";
}

export function useUnreadCount() {
  const { userId } = useSession();
  const query = useQuery({
    queryKey: ["unread", userId],
    enabled: Boolean(userId),
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId!)
        .eq("read", false);
      if (error) throw error;
      return count ?? 0;
    },
  });
  return query.data ?? 0;
}

export function useSignedUrl(path: string | null | undefined, bucket = "app-assets") {
  return useQuery({
    queryKey: ["signed-url", bucket, path],
    enabled: Boolean(path),
    staleTime: 30 * 60 * 1000,
    queryFn: () => signedAssetUrl(path, bucket),
  }).data;
}
