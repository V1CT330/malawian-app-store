import { Badge } from "@/components/ui/badge";

type DemoItem = {
  title: string;
  detail: string;
  metric?: string;
  status?: string;
};

export function DemoPreview({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: DemoItem[];
}) {
  return (
    <section className="mt-5 rounded-2xl border border-dashed border-primary/40 bg-accent/20 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Badge variant="outline">DEMO PREVIEW · SAMPLE DATA</Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <article key={item.title} className="rounded-xl border border-border bg-background p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium">{item.title}</p>
              {item.status ? <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{item.status}</span> : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
            {item.metric ? <p className="mt-3 text-xs font-semibold text-foreground">{item.metric}</p> : null}
          </article>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Illustrative content only. These examples are not real listings, users, reviews, or platform activity.</p>
    </section>
  );
}
