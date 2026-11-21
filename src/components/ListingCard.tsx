import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Globe, Smartphone, Star } from "lucide-react";

import { Dialog, DialogContent } from "@/components/ui/dialog";

import { Badge } from "@/components/ui/badge";
import { useSignedUrl } from "@/hooks/useSession";
import { type Listing } from "@/lib/store";
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


/** Swipeable store previews with a tap-to-expand image viewer. */
function ListingScreenshot({
  path,
  name,
  index,
  kind,
  compact,
}: {
  path: string;
  name: string;
  index: number;
  kind: Listing["kind"];
  compact: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isRemoteUrl = path.startsWith("http://") || path.startsWith("https://");
  const signedUrl = useSignedUrl(isRemoteUrl ? null : path);
  const src = isRemoteUrl ? path : signedUrl;
  if (!src) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View ${name} screenshot ${index + 1}`}
        className={cn(
          "flex shrink-0 snap-start items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary/50 p-1 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          compact ? "h-[168px] max-w-[136px]" : "h-[240px] max-w-[192px]",
          kind === "website" && (compact ? "h-[108px] max-w-[224px]" : "h-[150px] max-w-[300px]"),
        )}
      >
        <img
          src={src}
          alt={`${name} preview ${index + 1}`}
          loading="lazy"
          className="h-full w-auto max-w-full rounded-lg object-contain"
          onError={(event) => { event.currentTarget.closest("button")?.remove(); }}
        />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[92dvh] w-[96vw] max-w-5xl items-center justify-center border-0 bg-black/95 p-2 sm:rounded-xl">
          <img
            src={src}
            alt={`${name} screenshot ${index + 1}`}
            className="max-h-[86dvh] max-w-[92vw] object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ListingScreenshotStrip({
  screenshots,
  name,
  kind,
  compact = false,
}: {
  screenshots: string[] | null | undefined;
  name: string;
  kind: Listing["kind"];
  compact?: boolean;
}) {
  const paths = (screenshots ?? []).filter((path): path is string => typeof path === "string" && path.trim().length > 0);
  if (paths.length === 0) return null;

  return (
    <div
      className={cn("-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain px-1 pb-2", compact ? "mt-2" : "mt-3")}
      aria-label={`${name} screenshots`}
    >
      {paths.map((path, index) => (
        <ListingScreenshot
          key={`${path}-${index}`}
          path={path}
          name={name}
          index={index}
          kind={kind}
          compact={compact}
        />
      ))}
    </div>
  );
}

/** Play Store style vertical tile used inside horizontal carousels. */
export function ListingTile({ listing }: { listing: Listing }) {
  return (
    <Link
      to="/apps/$slug"
      params={{ slug: listing.slug }}
      className="w-[104px] shrink-0 transition-transform active:scale-[0.97]"
    >
      <AppIcon
        path={listing.icon_url}
        name={listing.name}
        className="h-[104px] w-[104px] rounded-[22px] shadow-soft"
      />
      <p className="mt-2 line-clamp-2 text-[13px] font-medium leading-tight">{listing.name}</p>
      <p className="mt-0.5 flex items-center gap-0.5 text-[11px] text-muted-foreground">
        {listing.rating_count ? (
          <>
            {listing.rating_avg.toFixed(1)}
            <Star className="h-2.5 w-2.5 fill-blue-500 text-blue-500" />
          </>
        ) : (
          "New"
        )}
      </p>
    </Link>
  );
}

/** Play Store style list row. */
export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link
      to="/apps/$slug"
      params={{ slug: listing.slug }}
      className="flex flex-col rounded-none border-0 px-1 py-2 shadow-none transition-colors hover:bg-secondary active:scale-[0.99]"
    >
      <div className="flex items-center gap-4">
      <AppIcon
        path={listing.icon_url}
        name={listing.name}
        className="h-16 w-16 rounded-[18px] shadow-soft"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[15px] font-medium">{listing.name}</p>
          {listing.kind === "website" ? (
            <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <Smartphone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {listing.tagline || listing.category}
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-0.5">
            {listing.rating_count ? listing.rating_avg.toFixed(1) : "New"}
            <Star className="h-3 w-3 fill-blue-500 text-blue-500" />
          </span>
          <span aria-hidden>·</span>
          <span>
            {listing.kind === "website"
              ? `${listing.downloads} visits`
              : `${listing.downloads} installs`}
          </span>
        </div>
      </div>
      </div>
      <ListingScreenshotStrip screenshots={listing.screenshots} name={listing.name} kind={listing.kind} compact />
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
            i <= Math.round(value) ? "fill-blue-500 text-blue-500" : "text-border",
          )}
        />
      ))}
    </div>
  );
}
