import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { ConsoleShell } from "@/components/console/ConsoleShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { SUBSCRIPTION_BENEFITS } from "@/lib/portal";
import { useRequireDeveloper } from "@/hooks/useRequireDeveloper";

export const Route = createFileRoute("/_authenticated/console/resources")({
  head: () => ({
    meta: [
      { title: "Developer Resources, Malawian App Store" },
      {
        name: "description",
        content:
          "Publishing guidelines, API docs, design guidelines, tutorials, FAQs and the feature request portal.",
      },
      { property: "og:title", content: "Developer Resources, Malawian App Store" },
      { property: "og:description", content: "Everything you need to publish well." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResourcesPage,
});

const GUIDES = [
  {
    title: "Publishing guidelines",
    body: "Every product is reviewed before it appears in the store. Your listing needs a clear name, a tagline, a description of at least 200 characters, an icon of 512 by 512 pixels and three screenshots. Apps must ship a signed build. Websites must use https. AI agents must state which model or provider they use. Browser extensions must list the permissions they request. Products that mislead users, harvest data without consent, or copy another developer's work are rejected.",
  },
  {
    title: "Design guidelines",
    body: "Use a square icon with no rounded corners baked in, the store applies the corner radius. Screenshots should be actual screens, not marketing collages, and the first screenshot should show the core task. Feature banners are 1024 by 500 pixels. Keep text on images short so it stays readable on small phones.",
  },
  {
    title: "Versioning and updates",
    body: "Use semantic versions such as 1.4.2. Ship a changelog with every release, and use release notes for the text shown to users in the store. Beta channel releases are only visible to invited testers. You can schedule a release for a future date, and roll back to any earlier version if a release causes problems.",
  },
  {
    title: "API documentation",
    body: "The store exposes an agent interface at /mcp using the Model Context Protocol. After signing in, a connected client can search apps, read a product, list your own products and notifications, and create a draft listing. All calls run as your signed in account, so you only ever see and change your own data.",
  },
  {
    title: "Tutorial: your first release",
    body: "1. Switch to developer mode in Account settings.\n2. Verify your phone over WhatsApp and submit KYC.\n3. Open Products and choose New product.\n4. Fill in the listing, upload an icon and screenshots, add tags and keywords.\n5. Use the AI publishing assistant to check quality and fix anything missing.\n6. Save as a draft, then publish when the score is above 75.",
  },
];

const FAQS = [
  {
    q: "How long does review take?",
    a: "Most products are reviewed within two working days. Subscribers go into the priority queue.",
  },
  {
    q: "What does the MK5,000 monthly subscription include?",
    a: SUBSCRIPTION_BENEFITS.join(". ") + ".",
  },
  {
    q: "Do I need KYC to publish?",
    a: "Yes. KYC verification protects users and unlocks the verified developer badge on your profile.",
  },
  {
    q: "Can I publish a website instead of an app?",
    a: "Yes. The store lists apps, websites, AI agents and browser extensions.",
  },
  {
    q: "How is my reputation score calculated?",
    a: "It combines product quality, user ratings, update frequency, rule compliance, profile completeness and how quickly you respond to reviews.",
  },
];

type FeatureRequest = {
  id: string;
  title: string;
  body: string | null;
  status: string;
  vote_count: number;
  created_at: string;
};

function ResourcesPage() {
  useRequireDeveloper();
  const { userId } = useSession();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const requests = useQuery({
    queryKey: ["feature-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_requests")
        .select("id,title,body,status,vote_count,created_at")
        .order("vote_count", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as FeatureRequest[];
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sign in required");
      if (title.trim().length < 5) throw new Error("Give your request a clear title");
      const { error } = await supabase
        .from("feature_requests")
        .insert({ user_id: userId, title: title.trim(), body: body.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request posted");
      setTitle("");
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["feature-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const vote = useMutation({
    mutationFn: async (r: FeatureRequest) => {
      const { error } = await supabase
        .from("feature_requests")
        .update({ vote_count: r.vote_count + 1 })
        .eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["feature-requests"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <ConsoleShell title="Help and resources">
      <h1 className="font-display text-2xl font-bold">Resources</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Documentation, guidelines, tutorials and the community feature request portal.
      </p>

      <section className="surface-card p-4">
        <h2 className="mb-2 font-display text-base font-semibold">Documentation</h2>
        <Accordion type="single" collapsible>
          {GUIDES.map((g) => (
            <AccordionItem key={g.title} value={g.title}>
              <AccordionTrigger className="text-left text-sm font-medium">
                {g.title}
              </AccordionTrigger>
              <AccordionContent className="whitespace-pre-line text-sm text-muted-foreground">
                {g.body}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="surface-card mt-4 p-4">
        <h2 className="mb-2 font-display text-base font-semibold">FAQs</h2>
        <Accordion type="single" collapsible>
          {FAQS.map((f) => (
            <AccordionItem key={f.q} value={f.q}>
              <AccordionTrigger className="text-left text-sm font-medium">{f.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="surface-card mt-4 p-4">
        <h2 className="font-display text-base font-semibold">Community and feature requests</h2>
        <p className="text-sm text-muted-foreground">
          Post an idea, or back one you want built next. The store team reviews the top requests
          every month.
        </p>
        <div className="mt-3 space-y-2">
          <Input
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What should we build?"
          />
          <Textarea
            rows={3}
            maxLength={800}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add any detail that helps"
          />
          <Button size="sm" disabled={submit.isPending} onClick={() => submit.mutate()}>
            Post request
          </Button>
        </div>

        <ul className="mt-4 space-y-3">
          {requests.data?.map((r) => (
            <li
              key={r.id}
              className="flex items-start gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
            >
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() => vote.mutate(r)}
              >
                ▲ {r.vote_count}
              </Button>
              <div className="min-w-0">
                <p className="text-sm font-medium">{r.title}</p>
                {r.body && <p className="text-sm text-muted-foreground">{r.body}</p>}
              </div>
              <Badge variant="secondary" className="ml-auto shrink-0 capitalize">
                {r.status}
              </Badge>
            </li>
          ))}
        </ul>
      </section>
    </ConsoleShell>
  );
}
