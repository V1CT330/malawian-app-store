import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { HostingDeployment, HostingDomain, HostingProject } from "@/lib/hosting";

export function useHostingProjects(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["hosting-projects", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hosting_projects")
        .select("*")
        .eq("owner_id", userId!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as HostingProject[];
    },
  });
}

export function useHostingProject(id: string | undefined) {
  return useQuery({
    queryKey: ["hosting-project", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hosting_projects")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as HostingProject | null;
    },
  });
}

export function useDeployments(projectId: string | undefined) {
  return useQuery({
    queryKey: ["hosting-deployments", projectId],
    enabled: Boolean(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hosting_deployments")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as HostingDeployment[];
    },
  });
}

export function useDomains(projectId: string | undefined) {
  return useQuery({
    queryKey: ["hosting-domains", projectId],
    enabled: Boolean(projectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hosting_domains")
        .select("*")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as HostingDomain[];
    },
  });
}
