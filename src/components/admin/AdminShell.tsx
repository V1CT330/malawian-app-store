import type { ReactNode } from "react";

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
      <footer className="border-t border-slate-200/80 px-4 py-5 text-center text-[11px] font-medium tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-500">
        MAS INTERNAL OPERATIONS · AUTHORIZED ADMINISTRATORS ONLY
      </footer>
    </div>
  );
}
