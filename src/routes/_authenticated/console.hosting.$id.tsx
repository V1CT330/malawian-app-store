import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Globe, History, Rocket, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConsoleShell } from "@/components/console/ConsoleShell";
import {
  EmptyState,
  MetricTile,
  RowSkeletons,
  SectionCard,
  StatusPill,
} from "@/components/console/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProfile } from "@/hooks/useSession";
import { useRequireDeveloper } from "@/hooks/useRequireDeveloper";
import { supabase } from "@/integrations/supabase/client";
import { formatBandwidth, getProvider } from "@/lib/hosting";
import { useDeployments, useDomains, useHostingProject } from "@/lib/hosting.queries";
import { useDeployProject } from "./console.hosting.index";

export const Route = createFileRoute("/_authenticated/console/hosting/$id")({
  head: () => ({
    meta: [
      { title: "Hosting project — Developer Console" },
      {
        name: "description",
        content: "Deploy this website, manage its custom domains and review deployment history.",
      },
      { property: "og:title", content: "Hosting project — Developer Console" },
      { property: "og:description", content: "Deployments, domains and traffic for one website." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HostingProjectPage,
});

function HostingProjectPage() {
  useRequireDeveloper();
  const { id } = Route.useParams();
  const { userId } = useProfile();
  const queryClient = useQueryClient();
  const projectQuery = useHostingProject(id);
  const project = projectQuery.data;
  const deploymentsQuery = useDeployments(id);
  const deployments = deploymentsQuery.data ?? [];
  const domainsQuery = useDomains(id);
  const domains = domainsQuery.data ?? [];
  const deploy = useDeployProject(userId);
  const [domain, setDomain] = useState("");

  const addDomain = useMutation({
    mutationFn: async () => {
      if (!project) throw new Error("Project not loaded yet.");
      const value = domain.trim().toLowerCase();
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(value)) throw new Error("Enter a domain like example.mw");
      const provider = getProvider(project.provider);
      const result = await provider.verifyDomain(
        {
          id: project.id,
          name: project.name,
          slug: project.slug,
          source: project.source === "github" ? "github" : "upload",
        },
        value,
      );
      const { error } = await supabase.from("hosting_domains").insert({
        project_id: project.id,
        owner_id: userId!,
        domain: value,
        status: result.status,
        is_primary: domains.length === 0,
      });
      if (error) throw error;
      return result;
    },
    onSuccess: async (result) => {
      setDomain("");
      await queryClient.invalidateQueries({ queryKey: ["hosting-domains", id] });
      toast.success(
        result.status === "verified" ? "Domain connected." : "Domain added. Waiting on DNS records.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeDomain = useMutation({
    mutationFn: async (domainId: string) => {
      const { error } = await supabase.from("hosting_domains").delete().eq("id", domainId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["hosting-domains", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const makePrimary = useMutation({
    mutationFn: async (domainId: string) => {
      await supabase.from("hosting_domains").update({ is_primary: false }).eq("project_id", id);
      const { error } = await supabase
        .from("hosting_domains")
        .update({ is_primary: true })
        .eq("id", domainId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["hosting-domains", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (projectQuery.isLoading) {
    return (
      <ConsoleShell title="Hosting project" breadcrumbs={[{ label: "Console", to: "/console" }]}>
        <RowSkeletons count={4} />
      </ConsoleShell>
    );
  }

  if (!project) {
    return (
      <ConsoleShell title="Hosting project" breadcrumbs={[{ label: "Console", to: "/console" }]}>
        <EmptyState
          icon={Globe}
          title="Project not found"
          description="This hosting project does not exist or is not yours."
          action={
            <Button asChild variant="outline">
              <Link to="/console/hosting">Back to hosting</Link>
            </Button>
          }
        />
      </ConsoleShell>
    );
  }

  const primary = domains.find((d) => d.is_primary)?.domain ?? `${project.slug}.mas.host`;

  return (
    <ConsoleShell
      title={project.name}
      description={`${project.source === "github" ? "Connected to GitHub" : "Uploaded files"} · ${primary}`}
      breadcrumbs={[
        { label: "Console", to: "/console" },
        { label: "Hosting", to: "/console/hosting" },
        { label: project.name },
      ]}
      actions={
        <Button
          disabled={deploy.isPending || project.status === "building"}
          onClick={() => deploy.mutate(project)}
        >
          <Rocket className="mr-2 h-4 w-4" />
          {project.status === "building" ? "Building…" : "Deploy"}
        </Button>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="surface-card p-5">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Status
            </p>
            <div className="mt-3">
              <StatusPill status={project.status} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {project.last_deployed_at
                ? `Last deploy ${new Date(project.last_deployed_at).toLocaleString()}`
                : "Never deployed"}
            </p>
          </div>
          <MetricTile label="Visits" value={Number(project.visits).toLocaleString()} hint="Last 30 days" />
          <MetricTile
            label="Bandwidth"
            value={formatBandwidth(Number(project.bandwidth_mb))}
            hint="Last 30 days"
          />
          <MetricTile label="Deployments" value={deployments.length} hint="Recent builds" />
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="domains">Domains</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            <SectionCard title="Project details">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Address</dt>
                  <dd className="font-medium">{project.slug}.mas.host</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Source</dt>
                  <dd className="font-medium">
                    {project.source === "github" ? project.repo_url : "Uploaded files"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Branch</dt>
                  <dd className="font-medium">{project.branch}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Framework</dt>
                  <dd className="font-medium capitalize">{project.framework}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Hosting provider</dt>
                  <dd className="font-medium">{getProvider(project.provider).label}</dd>
                </div>
              </dl>
            </SectionCard>
          </TabsContent>

          <TabsContent value="domains" className="mt-4 space-y-4">
            <SectionCard title="Custom domains">
              <div className="flex flex-wrap gap-2">
                <Input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="example.mw"
                  className="min-w-[200px] flex-1"
                  aria-label="Custom domain"
                />
                <Button onClick={() => addDomain.mutate()} disabled={addDomain.isPending}>
                  {addDomain.isPending ? "Checking…" : "Add domain"}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Point an A record to 185.158.133.1 at your domain provider, then add it here.
              </p>
              {domainsQuery.isLoading ? (
                <div className="mt-4">
                  <RowSkeletons count={2} />
                </div>
              ) : domains.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  No custom domain yet. Your site is reachable at {project.slug}.mas.host
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-border">
                  {domains.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{d.domain}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.is_primary ? "Primary domain" : "Secondary domain"}
                        </p>
                      </div>
                      <StatusPill status={d.status} />
                      {!d.is_primary && (
                        <Button size="sm" variant="ghost" onClick={() => makePrimary.mutate(d.id)}>
                          Make primary
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Remove ${d.domain}`}
                        onClick={() => removeDomain.mutate(d.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="history" className="mt-4 space-y-4">
            <SectionCard title="Deployment history">
              {deploymentsQuery.isLoading ? (
                <RowSkeletons count={3} />
              ) : deployments.length === 0 ? (
                <EmptyState
                  icon={History}
                  title="No deployments yet"
                  description="Press Deploy to publish the current version of this website."
                />
              ) : (
                <ul className="space-y-3">
                  {deployments.map((d) => (
                    <li key={d.id} className="inset-tile rounded-2xl p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill status={d.status} />
                        <p className="text-sm font-medium">
                          {d.commit_message ?? "Deployment"}
                        </p>
                        <p className="ml-auto text-xs text-muted-foreground">
                          {new Date(d.created_at).toLocaleString()}
                          {d.duration_seconds ? ` · ${d.duration_seconds}s` : ""}
                        </p>
                      </div>
                      {d.build_log && (
                        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                          {d.build_log}
                        </pre>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </TabsContent>
        </Tabs>
      </div>
    </ConsoleShell>
  );
}
