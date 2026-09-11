import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Cloud, Github, Globe, Plus, Rocket, Upload } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProfile } from "@/hooks/useSession";
import { useRequireDeveloper } from "@/hooks/useRequireDeveloper";
import { supabase } from "@/integrations/supabase/client";
import { formatBandwidth, getProvider, slugify, type HostingProject } from "@/lib/hosting";
import { useHostingProjects } from "@/lib/hosting.queries";

export const Route = createFileRoute("/_authenticated/console/hosting/")({
  head: () => ({
    meta: [
      { title: "MAS Hosting — Developer Console" },
      {
        name: "description",
        content:
          "Host websites on MAS Hosting: create projects, deploy in one click, manage domains and watch traffic.",
      },
      { property: "og:title", content: "MAS Hosting — Developer Console" },
      {
        property: "og:description",
        content: "Create projects, deploy websites and manage custom domains.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HostingPage,
});

function CreateProject({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [source, setSource] = useState<"upload" | "github">("upload");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [framework, setFramework] = useState("static");
  const [files, setFiles] = useState<number>(0);

  const create = useMutation({
    mutationFn: async () => {
      if (name.trim().length < 3) throw new Error("Give the project a name of at least 3 characters.");
      if (source === "github" && !/^https?:\/\/.+\..+/.test(repo))
        throw new Error("Add the full repository address, starting with https://");
      const { data, error } = await supabase
        .from("hosting_projects")
        .insert({
          owner_id: userId,
          name: name.trim(),
          slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`,
          source,
          repo_url: source === "github" ? repo.trim() : null,
          branch: branch.trim() || "main",
          framework,
          provider: "mas",
          status: "offline",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["hosting-projects", userId] });
      setOpen(false);
      setName("");
      setRepo("");
      setFiles(0);
      toast.success("Project created. Deploy it when you are ready.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Create project
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create hosting project</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="hp-name">Project name</Label>
            <Input
              id="hp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My business website"
            />
            {name && (
              <p className="text-xs text-muted-foreground">Address: {slugify(name)}.mas.host</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Where the website comes from</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSource("upload")}
                className={`inset-tile flex items-center gap-2 rounded-xl border p-3 text-left text-sm ${
                  source === "upload" ? "border-primary" : "border-border"
                }`}
              >
                <Upload className="h-4 w-4" /> Upload files
              </button>
              <button
                type="button"
                onClick={() => setSource("github")}
                className={`inset-tile flex items-center gap-2 rounded-xl border p-3 text-left text-sm ${
                  source === "github" ? "border-primary" : "border-border"
                }`}
              >
                <Github className="h-4 w-4" /> GitHub repo
              </button>
            </div>
          </div>

          {source === "upload" ? (
            <div className="space-y-1.5">
              <Label htmlFor="hp-files">Website files</Label>
              <Input
                id="hp-files"
                type="file"
                multiple
                onChange={(e) => setFiles(e.target.files?.length ?? 0)}
              />
              <p className="text-xs text-muted-foreground">
                {files > 0 ? `${files} files ready` : "Select your index.html and assets."}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="hp-repo">Repository address</Label>
                <Input
                  id="hp-repo"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="https://github.com/you/site"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hp-branch">Branch</Label>
                <Input id="hp-branch" value={branch} onChange={(e) => setBranch(e.target.value)} />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Framework</Label>
            <Select value={framework} onValueChange={setFramework}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="static">Static HTML</SelectItem>
                <SelectItem value="react">React</SelectItem>
                <SelectItem value="next">Next.js</SelectItem>
                <SelectItem value="vue">Vue</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useDeployProject(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (project: HostingProject) => {
      const provider = getProvider(project.provider);
      const input = {
        id: project.id,
        name: project.name,
        slug: project.slug,
        source: project.source === "github" ? ("github" as const) : ("upload" as const),
        repoUrl: project.repo_url,
        branch: project.branch,
        framework: project.framework,
      };

      const { data: pending, error: insertError } = await supabase
        .from("hosting_deployments")
        .insert({
          project_id: project.id,
          owner_id: userId!,
          status: "building",
          source: project.source,
        })
        .select("id")
        .single();
      if (insertError) throw insertError;

      await supabase.from("hosting_projects").update({ status: "building" }).eq("id", project.id);
      await queryClient.invalidateQueries({ queryKey: ["hosting-projects", userId] });
      await queryClient.invalidateQueries({ queryKey: ["hosting-project", project.id] });
      await queryClient.invalidateQueries({ queryKey: ["hosting-deployments", project.id] });

      const result = await provider.deploy(input);
      const usage = await provider.usage(input);

      await supabase
        .from("hosting_deployments")
        .update({
          status: result.status === "online" ? "online" : "failed",
          url: result.url,
          build_log: result.log,
          duration_seconds: result.durationSeconds,
          commit_message: result.commitMessage,
        })
        .eq("id", pending.id);

      await supabase
        .from("hosting_projects")
        .update({
          status: result.status,
          last_deployed_at: new Date().toISOString(),
          visits: result.status === "online" ? usage.visits : project.visits,
          bandwidth_mb: result.status === "online" ? usage.bandwidthMb : project.bandwidth_mb,
        })
        .eq("id", project.id);

      return result;
    },
    onSuccess: async (result, project) => {
      await queryClient.invalidateQueries({ queryKey: ["hosting-projects", userId] });
      await queryClient.invalidateQueries({ queryKey: ["hosting-project", project.id] });
      await queryClient.invalidateQueries({ queryKey: ["hosting-deployments", project.id] });
      if (result.status === "online") toast.success(`${project.name} is online.`);
      else toast.error(`${project.name} failed to build. Check the deployment log.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

function HostingPage() {
  useRequireDeveloper();
  const { userId } = useProfile();
  const projectsQuery = useHostingProjects(userId);
  const projects = projectsQuery.data ?? [];
  const deploy = useDeployProject(userId);

  const online = projects.filter((p) => p.status === "online").length;
  const visits = projects.reduce((t, p) => t + Number(p.visits ?? 0), 0);
  const bandwidth = projects.reduce((t, p) => t + Number(p.bandwidth_mb ?? 0), 0);

  return (
    <ConsoleShell
      title="MAS Hosting"
      description="Host your websites on MAS. Create a project, deploy in one click, then point your own domain at it."
      breadcrumbs={[{ label: "Console", to: "/console" }, { label: "Hosting" }]}
      actions={userId ? <CreateProject userId={userId} /> : null}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricTile label="Projects" value={projects.length} hint="Hosted websites" />
          <MetricTile label="Online" value={online} hint="Serving traffic now" />
          <MetricTile label="Visits" value={visits.toLocaleString()} hint="Last 30 days" />
          <MetricTile label="Bandwidth" value={formatBandwidth(bandwidth)} hint="Last 30 days" />
        </div>

        <SectionCard title={`Projects (${projects.length})`}>
          {projectsQuery.isLoading ? (
            <RowSkeletons count={3} />
          ) : projects.length === 0 ? (
            <EmptyState
              icon={Cloud}
              title="No hosted websites yet"
              description="Create a project, upload your files or connect a GitHub repository, then deploy."
            />
          ) : (
            <ul className="divide-y divide-border">
              {projects.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/console/hosting/$id"
                      params={{ id: p.id }}
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {p.name}
                    </Link>
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <Globe className="h-3 w-3" /> {p.slug}.mas.host ·{" "}
                      {p.source === "github" ? "GitHub" : "Uploaded files"}
                    </p>
                  </div>
                  <StatusPill status={p.status} />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={deploy.isPending || p.status === "building"}
                    onClick={() => deploy.mutate(p)}
                  >
                    <Rocket className="mr-2 h-4 w-4" />
                    {p.status === "building" ? "Building…" : "Deploy"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </ConsoleShell>
  );
}
