import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { PortalListing } from "@/lib/portal";

/** Every product owned by the signed in developer, newest activity first. */
export function useMyListings(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["console-listings", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("developer_id", userId!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PortalListing[];
    },
  });
}

export function useListing(id: string | undefined) {
  return useQuery({
    queryKey: ["console-listing", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from("listings").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as PortalListing | null;
    },
  });
}

export type StatsRow = { day: string; installs: number; views: number };

export function useDeveloperStats(userId: string | null | undefined, days = 30) {
  return useQuery({
    queryKey: ["developer-stats", userId, days],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("developer_stats", {
        _developer: userId!,
        _days: days,
      });
      if (error) throw error;
      return (data ?? []).map((r: { day: string; installs: number; views: number }) => ({
        day: String(r.day),
        installs: Number(r.installs ?? 0),
        views: Number(r.views ?? 0),
      })) as StatsRow[];
    },
  });
}

export function sum(rows: StatsRow[] | undefined, key: "installs" | "views") {
  return (rows ?? []).reduce((total, row) => total + row[key], 0);
}

export function conversion(rows: StatsRow[] | undefined) {
  const views = sum(rows, "views");
  if (!views) return 0;
  return Math.round((sum(rows, "installs") / views) * 100);
}
