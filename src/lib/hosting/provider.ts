/**
 * Provider based hosting architecture.
 *
 * MAS Hosting talks to providers through this interface only, so a real
 * Cloudflare Pages, Netlify, Vercel or self hosted adapter can be added later
 * without touching any console screen.
 */

export type DeployStatus = "online" | "building" | "failed" | "offline";

export type HostingProjectInput = {
  id: string;
  name: string;
  slug: string;
  source: "upload" | "github";
  repoUrl?: string | null;
  branch?: string | null;
  framework?: string | null;
};

export type DeployResult = {
  status: DeployStatus;
  url: string;
  durationSeconds: number;
  log: string;
  commitMessage: string;
};

export type DomainResult = { status: "pending" | "verified" | "failed"; records: string[] };

export type UsageResult = { visits: number; bandwidthMb: number };

export interface HostingProvider {
  id: string;
  label: string;
  /** True once real API credentials are wired up. */
  live: boolean;
  deploy(project: HostingProjectInput): Promise<DeployResult>;
  verifyDomain(project: HostingProjectInput, domain: string): Promise<DomainResult>;
  usage(project: HostingProjectInput): Promise<UsageResult>;
  previewUrl(project: HostingProjectInput): string;
}

const registry = new Map<string, HostingProvider>();

export function registerProvider(provider: HostingProvider) {
  registry.set(provider.id, provider);
}

export function getProvider(id: string | null | undefined): HostingProvider {
  return registry.get(id ?? "mas") ?? registry.get("mas")!;
}

export function listProviders(): HostingProvider[] {
  return [...registry.values()];
}
