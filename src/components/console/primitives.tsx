import { type ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  draft: "border-border text-muted-foreground",
  pending: "border-foreground/25 text-foreground",
  published: "border-brand-green/40 bg-accent text-accent-foreground",
  rejected: "border-brand-red/40 text-brand-red",
  archived: "border-border text-muted-foreground",
  scheduled: "border-foreground/25 text-foreground",
  released: "border-brand-green/40 bg-accent text-accent-foreground",
  active: "border-brand-green/40 bg-accent text-accent-foreground",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending: "In review",
  published: "Live",
  rejected: "Rejected",
  archived: "Archived",
  scheduled: "Scheduled",
  released: "Released",
  active: "Active",
};

/** One status vocabulary for the whole console. */
export function StatusPill({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        STATUS_STYLES[status] ?? "border-border text-muted-foreground",
        className,
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function MetricTile({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: string | number;
  delta?: number | null;
  hint?: string;
}) {
  return (
    <div className="surface-card p-5 transition-shadow hover:shadow-soft">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-[32px] font-bold leading-none tabular-nums">{value}</p>
      {delta !== undefined && delta !== null ? (
        <p
          className={cn(
            "mt-1.5 text-xs font-medium",
            delta > 0 ? "text-brand-green" : delta < 0 ? "text-brand-red" : "text-muted-foreground",
          )}
        >
          {delta > 0 ? "+" : ""}
          {delta}% vs previous period
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function SectionCard({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("surface-card p-5 sm:p-6", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-display text-[17px] font-semibold tracking-tight">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
      {Icon && <Icon className="h-6 w-6 text-muted-foreground" />}
      <p className="font-display text-base font-semibold">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function RowSkeletons({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-2xl" />
      ))}
    </div>
  );
}

export function TileSkeletons({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-2xl" />
      ))}
    </div>
  );
}

export function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="surface-card border-l-4 border-l-brand-red p-4">
      <p className="text-sm font-medium">Something went wrong</p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 text-sm font-medium text-primary underline">
          Try again
        </button>
      )}
    </div>
  );
}

export function ProChip({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground",
        className,
      )}
    >
      Pro
    </span>
  );
}
