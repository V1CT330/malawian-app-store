import { Link } from "@tanstack/react-router";
import { Globe, Smartphone, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useSignedUrl } from "@/hooks/useSession";
import { formatMwk, type Listing } from "@/lib/store";
import { cn } from "@/lib/utils";

export function AppIcon({
  path,
  name,
  className,
}: {
  path: string | null;
  name: string;
  className?: string;
}) {
  const url = useSignedUrl(path);
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-accent text-accent-foreground",
        className,
      )}
    >
      {url ? (
        <img src={url} alt={`${name} icon`} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span className="font-display text-lg font-semibold">{name.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link
      to="/apps/$slug"
      params={{ slug: listing.slug }}
      className="surface-card flex items-center gap-3 p-3 transition-transform active:scale-[0.99]"
    >
      <AppIcon path={listing.icon_url} name={listing.name} className="h-14 w-14" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate font-display text-sm font-semibold">{listing.name}</p>
          {listing.kind === "website" ? (
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">{listing.tagline || listing.category}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-0.5">
            <Star className="h-3 w-3 fill-google-yellow text-google-yellow" />
            {listing.rating_count ? listing.rating_avg.toFixed(1) : "New"}
          </span>
          <span aria-hidden>·</span>
          <span>{listing.downloads} installs</span>
        </div>
      </div>
      <Badge variant={listing.price_mwk === 0 ? "secondary" : "default"} className="shrink-0">
        {formatMwk(listing.price_mwk)}
      </Badge>
    </Link>
  );
}

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-0.5", className)} aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "h-4 w-4",
            i <= Math.round(value) ? "fill-google-yellow text-google-yellow" : "text-border",
          )}
        />
      ))}
    </div>
  );
}
