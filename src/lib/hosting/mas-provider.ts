import {
  registerProvider,
  type DeployResult,
  type DomainResult,
  type HostingProvider,
  type HostingProjectInput,
  type UsageResult,
} from "./provider";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hash(value: string) {
  let total = 0;
  for (let i = 0; i < value.length; i += 1) total = (total * 31 + value.charCodeAt(i)) % 100000;
  return total;
}

/**
 * Simulated provider used until real hosting credentials exist.
 * Every other adapter (Cloudflare Pages, Netlify, Vercel) implements the same
 * interface, so switching a project over is a single field change.
 */
const masProvider: HostingProvider = {
  id: "mas",
  label: "MAS Hosting",
  live: false,

  previewUrl(project: HostingProjectInput) {
    return `https://${project.slug}.mas.host`;
  },

  async deploy(project: HostingProjectInput): Promise<DeployResult> {
    await wait(1600);
    const seed = hash(project.id + Date.now().toString());
    const failed = seed % 9 === 0;
    const duration = 18 + (seed % 40);
    const steps = [
      `[mas] queued ${project.source === "github" ? project.repoUrl : "uploaded bundle"}`,
      `[mas] framework: ${project.framework ?? "static"}`,
      "[mas] installing dependencies",
      "[mas] building",
      failed ? "[mas] build failed: exit code 1" : "[mas] uploading assets to edge",
      failed ? "[mas] deployment aborted" : `[mas] live at ${this.previewUrl(project)}`,
    ];
    return {
      status: failed ? "failed" : "online",
      url: this.previewUrl(project),
      durationSeconds: duration,
      log: steps.join("\n"),
      commitMessage:
        project.source === "github"
          ? `Deploy ${project.branch ?? "main"} branch`
          : "Manual upload deploy",
    };
  },

  async verifyDomain(_project: HostingProjectInput, domain: string): Promise<DomainResult> {
    await wait(900);
    return {
      status: hash(domain) % 5 === 0 ? "pending" : "verified",
      records: [`A  @  185.158.133.1`, `CNAME  www  ${domain}`],
    };
  },

  async usage(project: HostingProjectInput): Promise<UsageResult> {
    const seed = hash(project.slug);
    return { visits: 120 + (seed % 4200), bandwidthMb: Math.round((seed % 900) + 45) };
  },
};

registerProvider(masProvider);

export { masProvider };
