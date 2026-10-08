import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Malawian App Store" },
      {
        name: "description",
        content: "Discover, install and publish apps and websites built in Malawi.",
      },
      { property: "og:title", content: "Malawian App Store" },
      {
        property: "og:description",
        content: "Discover, install and publish apps and websites built in Malawi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=DM+Sans:wght@400;500;600&display=swap",
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
    ],
    scripts: [
      {
        children: `(function(){try{var d=document.documentElement;var t=localStorage.getItem('mas:theme');var dark=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;d.classList.toggle('dark',dark);var a=localStorage.getItem('mas:accent');if(a&&/^#[0-9a-f]{6}$/i.test(a)){var s=d.style;s.setProperty('--primary',a);s.setProperty('--ring',a);s.setProperty('--sidebar-primary',a);s.setProperty('--accent','color-mix(in oklab, '+a+' 15%, var(--background))');s.setProperty('--accent-foreground',a);s.setProperty('--sidebar-accent','color-mix(in oklab, '+a+' 15%, var(--sidebar))');s.setProperty('--sidebar-accent-foreground',a);}}catch(e){}})();`,
      },
      {
        children: `
          (function() {
          if (document.getElementById('lovable-inhibitor-css')) return;
          const style = document.createElement('style');
          style.id = 'lovable-inhibitor-css';
          style.textContent = \`
            /* Hide badge / watermark selectors Lovable has used */
            [data-lovable-badge],
            [class*="lovable-badge"],
            [class*="LovableBadge"],
            [id*="lovable-badge"],
            a[href*="lovable.dev"],
            a[href*="lovable.app"] {
              display: none !important;
              visibility: hidden !important;
              opacity: 0 !important;
              pointer-events: none !important;
              width: 0 !important;
              height: 0 !important;
            }
          \`;
          document.head.appendChild(style);
          })();
        `,
      },
      {
        children: `
          (function() {
            const PATTERNS = [/lovable/i, /made with lovable/i];
            const SELECTORS = 'a, div, span, footer, [data-lovable-badge]';

            function shouldHide(el) {
              const text = (el.innerText || '').trim();
              const href = (el.getAttribute && el.getAttribute('href')) || '';
              if (el.tagName === 'A' && !/^https?:/i.test(href) && !/lovable/i.test(text)) return false;
              const cls = el.className?.toString() || '';
              const id = el.id || '';
              const combined = \`\${text} \${href} \${cls} \${id}\`;
              return PATTERNS.some(rx => rx.test(combined)) && 
                     (text.length < 100 || /lovable/i.test(href)); // avoid hiding big paragraphs
            }

            function scrub() {
              document.querySelectorAll(SELECTORS).forEach(el => {
                if (shouldHide(el)) {
                  el.style.setProperty('display', 'none', 'important');
                  el.remove();
                }
              });
              // scrub meta generator
              document.querySelectorAll('meta[name="generator"], meta[property="og:site_name"]').forEach(m => {
                if (/lovable/i.test(m.content)) m.remove();
              });
            }

            function start() {
              scrub();
              const observer = new MutationObserver(scrub);
              observer.observe(document.body, { childList: true, subtree: true });
            }
            // Wait until React has hydrated so the scrubber never alters server HTML.
            if (document.readyState === 'complete') setTimeout(start, 1500);
            else window.addEventListener('load', function () { setTimeout(start, 1500); });
          })();
        `,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      if (event === "SIGNED_IN" && typeof window !== "undefined") {
        const target = sessionStorage.getItem("mas:redirect");
        if (target) {
          sessionStorage.removeItem("mas:redirect");
          router.navigate({ to: target });
        }
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster />
    </QueryClientProvider>
  );
}
