import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { ListingCard } from "@/components/ListingCard";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { SOCIAL_FIELDS, type Listing } from "@/lib/store";

export const Route = createFileRoute("/developers/$id")({
  head: () => ({
    meta: [
      { title: "Developer Profile, Malawian App Store" },
      { name: "description", content: "Apps and websites published by this Malawian developer." },
      { property: "og:title", content: "Developer Profile, Malawian App Store" },
      { property: "og:description", content: "Apps and websites by a Malawian developer." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DeveloperPage,
});

function DeveloperPage() {
  const { id } = Route.useParams();

  const profile = useQuery({
    queryKey: ["developer", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_profiles")
        .select("id,display_name,developer_name,kyc_status,bio,website_url,github_url,portfolio_url,facebook_url,x_url,linkedin_url,instagram_url,youtube_url")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const listings = useQuery({
    queryKey: ["developer-listings", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id,developer_id,slug,name,tagline,description,category,kind,icon_url,downloads,rating_avg,rating_count,created_at,status")
        .eq("developer_id", id)
        .eq("status", "published")
        .order("downloads", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Listing[];
    },
  });

  const externalProjects = useQuery({
    queryKey: ["developer-portfolio-projects", id],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("developer_portfolio_projects")
        .select("id,title,description,project_type,url,image_url,created_at")
        .eq("developer_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const p = profile.data as Record<string, string | boolean | null> | null | undefined;

  return (
    <AppShell>
      {profile.isLoading ? (
        <Skeleton className="h-24 w-full rounded-2xl" />
      ) : (
        <header className="surface-card p-5">
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
            {(p?.developer_name as string) || (p?.display_name as string) || "Developer"}
            {p?.kyc_status === "approved" && <BadgeCheck className="h-5 w-5 text-primary" />}
          </h1>
          {p?.bio && <p className="mt-2 text-sm text-muted-foreground">{p.bio as string}</p>}
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {SOCIAL_FIELDS.map((f) =>
              p?.[f.key] ? (
                <a
                  key={f.key}
                  href={p[f.key] as string}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-primary underline"
                >
                  {f.label}
                </a>
              ) : null,
            )}
          </div>
        </header>
      )}

      <section className="mt-6">
        <h2 className="font-display text-lg font-semibold">Featured projects</h2>
        <p className="mt-1 text-sm text-muted-foreground">Projects this developer has published outside Malawian App Store.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {externalProjects.isLoading ? <Skeleton className="h-36 w-full rounded-2xl" /> : externalProjects.data?.length ? externalProjects.data.map((project: { id: string; title: string; description: string | null; project_type: string; url: string; image_url: string | null }) => (
            <article key={project.id} className="surface-card min-w-0 overflow-hidden">
              {project.image_url ? <img src={project.image_url} alt="" loading="lazy" className="h-36 w-full object-cover" /> : <div className="flex h-24 items-center justify-center bg-muted"><span className="text-sm text-muted-foreground">Featured project</span></div>}
              <div className="p-4">
                <p className="break-words font-semibold">{project.title}</p>
                <p className="mt-1 text-xs capitalize text-muted-foreground">{project.project_type}</p>
                {project.description && <p className="mt-2 break-words text-sm text-muted-foreground">{project.description}</p>}
                <a href={project.url} target="_blank" rel="noreferrer noopener" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary underline">Open project <span aria-hidden="true">↗</span></a>
              </div>
            </article>
          )) : <p className="surface-card p-5 text-sm text-muted-foreground">No featured projects yet.</p>}
        </div>
      </section>

      <h2 className="mt-6 font-display text-lg font-semibold">Published listings</h2>
      <div className="mt-3 space-y-3">
        {listings.isLoading ? (
          <Skeleton className="h-20 w-full rounded-2xl" />
        ) : listings.data?.length ? (
          listings.data.map((l) => <ListingCard key={l.id} listing={l} />)
        ) : (
          <p className="surface-card p-6 text-center text-sm text-muted-foreground">
            No published listings yet.
          </p>
        )}
      </div>
    </AppShell>
  );
}
