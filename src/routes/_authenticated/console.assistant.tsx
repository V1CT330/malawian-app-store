import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConsoleShell } from "@/components/console/ConsoleShell";
import { GeminiIcon } from "@/components/GeminiIcon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProfile } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { hasProAccess } from "@/lib/pro-access";
import { Textarea } from "@/components/ui/textarea";
import { askAssistant } from "@/lib/assistant.functions";
import { cn } from "@/lib/utils";
import { useRequireDeveloper } from "@/hooks/useRequireDeveloper";

export const Route = createFileRoute("/_authenticated/console/assistant")({
  head: () => ({
    meta: [
      { title: "AI Agent, Malawian App Store" },
      {
        name: "description",
        content:
          "Get AI help writing listings, passing KYC and planning app updates on the Malawian App Store.",
      },
      { property: "og:title", content: "AI Agent, Malawian App Store" },
      { property: "og:description", content: "AI help for Malawian app developers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssistantPage,
});

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Write a listing description for a Malawi bus booking app",
  "How do I get the KYC verified badge?",
  "What should go in my version changelog?",
];

function AssistantPage() {
  useRequireDeveloper();
  const { userId } = useProfile();
  const subscription = useQuery({
    queryKey: ["subscription", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("plan,status,current_period_end")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const hasPro = hasProAccess(subscription.data);
  const ask = useServerFn(askAssistant);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    const history = messages.slice(-10);
    setMessages([...messages, { role: "user", content: message }]);
    setBusy(true);
    try {
      const result = await ask({ data: { message, history } });
      setMessages((prev) => [...prev, { role: "assistant", content: result.reply }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The assistant is unavailable right now.");
    } finally {
      setBusy(false);
    }
  }

  if (subscription.isLoading) {
    return <ConsoleShell title="AI assistant"><p className="text-sm text-muted-foreground">Checking Developer Pro access…</p></ConsoleShell>;
  }

  if (subscription.isError) {
    return (
      <ConsoleShell title="AI assistant">
        <section className="surface-card space-y-3 p-5">
          <h1 className="font-display text-xl font-semibold">Unable to verify subscription</h1>
          <p className="text-sm text-muted-foreground">We could not confirm your Developer Pro status. Retry before using the AI assistant.</p>
          <Button variant="outline" onClick={() => void subscription.refetch()}>Retry</Button>
        </section>
      </ConsoleShell>
    );
  }

  if (!hasPro) {
    return (
      <ConsoleShell title="AI assistant">
        <section className="surface-card space-y-3 p-5">
          <Badge variant="outline">Developer Pro feature</Badge>
          <h1 className="font-display text-xl font-semibold">AI assistant requires Developer Pro</h1>
          <p className="text-sm text-muted-foreground">Upgrade to an active paid subscription to use the MAS AI publishing assistant.</p>
          <Button asChild><Link to="/console/subscription">Upgrade to Developer Pro</Link></Button>
        </section>
      </ConsoleShell>
    );
  }

  return (
    <ConsoleShell title="AI assistant">
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
        <GeminiIcon className="h-6 w-6" /> AI agent
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Powered by Gemini. Your publishing assistant for listings, KYC and updates.
      </p>

      {messages.length === 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm",
              m.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "surface-card text-foreground",
            )}
          >
            {m.content}
          </div>
        ))}
        {busy && <p className="text-sm text-muted-foreground">Thinking…</p>}
      </div>

      <div className="sticky bottom-20 mt-4 flex items-end gap-2 sm:bottom-4">
        <Textarea
          value={input}
          rows={2}
          maxLength={2000}
          placeholder="Ask about listings, KYC, updates…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          className="bg-background"
        />
        <Button
          size="icon"
          disabled={busy || !input.trim()}
          onClick={() => send(input)}
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </ConsoleShell>
  );
}
