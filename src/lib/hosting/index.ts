import "./mas-provider";

export * from "./provider";

export type HostingProject = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  source: string;
  repo_url: string | null;
  branch: string;
  framework: string;
  provider: string;
  status: string;
  last_deployed_at: string | null;
  visits: number;
  bandwidth_mb: number;
  created_at: string;
  updated_at: string;
};

export type HostingDeployment = {
  id: string;
  project_id: string;
  status: string;
  commit_message: string | null;
  source: string;
  build_log: string | null;
  duration_seconds: number | null;
  url: string | null;
  created_at: string;
};

export type HostingDomain = {
  id: string;
  project_id: string;
  domain: string;
  is_primary: boolean;
  status: string;
  created_at: string;
};

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function formatBandwidth(mb: number) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}
