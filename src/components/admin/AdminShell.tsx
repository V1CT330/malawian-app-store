import type { ReactNode } from "react";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";

import logo from "@/assets/logo-mark.png";

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950 text-white shadow-lg shadow-slate-950/10">
        <div className="mx-auto flex min-h-16 w-full max-w-[1440px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <img src={logo} alt="Malawian App Store" width={34} height={34} className="h-[34px] w-[34px] shrink-0 rounded-lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-wide">MAS CONTROL CENTER</p>
              <p className="truncate text-[11px] font-medium tracking-[0.14em] text-slate-400">PLATFORM ADMINISTRATION</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-emerald-300 sm:inline-flex">
              <ShieldCheck className="h-3.5 w-3.5" /> RESTRICTED
            </span>
            <Link to="/" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800">
              Storefront <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
      <footer className="border-t border-slate-200/80 px-4 py-5 text-center text-[11px] font-medium tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-500">
        MAS INTERNAL OPERATIONS · AUTHORIZED ADMINISTRATORS ONLY
      </footer>
    </div>
  );
}
