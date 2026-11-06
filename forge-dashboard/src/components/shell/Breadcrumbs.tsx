"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface Crumb {
  label: ReactNode;
  href?: string;
  mono?: boolean;
}

const Ctx = createContext<{ crumbs: Crumb[] | null; set: (c: Crumb[] | null) => void } | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [crumbs, set] = useState<Crumb[] | null>(null);
  return <Ctx.Provider value={{ crumbs, set }}>{children}</Ctx.Provider>;
}

/** Pages declare their trail; the top bar renders it. `key` should change when the trail does. */
export function useBreadcrumbs(crumbs: Crumb[], key: string) {
  const ctx = useContext(Ctx);
  const set = ctx?.set;
  useEffect(() => {
    set?.(crumbs);
    return () => set?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, set]);
}

const DEFAULTS: Record<string, string> = {
  overview: "Overview",
  projects: "Projects",
  activity: "Activity",
  settings: "Settings",
  deployments: "Deployments",
  new: "New project",
};

export function Breadcrumbs({ pathname }: { pathname: string }) {
  const ctx = useContext(Ctx);
  const segs = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] =
    ctx?.crumbs ??
    segs.map((s, i) => ({
      label: DEFAULTS[s] ?? s,
      href: i < segs.length - 1 ? "/" + segs.slice(0, i + 1).join("/") : undefined,
    }));

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-[13px]">
        <li className="hidden shrink-0 text-zinc-500 sm:block">
          <Link href="/overview" className="rounded px-1 hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-brand-500/70 focus-visible:outline-none">
            Forge
          </Link>
        </li>
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={i} className={last ? "flex min-w-0 items-center gap-1" : "hidden min-w-0 items-center gap-1 sm:flex"}>
              <ChevronRight className={i === 0 ? "hidden size-3.5 shrink-0 text-zinc-700 sm:block" : "size-3.5 shrink-0 text-zinc-700"} aria-hidden />
              {c.href && !last ? (
                <Link
                  href={c.href}
                  className={`truncate rounded px-1 text-zinc-500 hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-brand-500/70 focus-visible:outline-none ${c.mono ? "font-mono text-xs" : ""}`}
                >
                  {c.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={`truncate px-1 font-medium text-zinc-100 ${c.mono ? "font-mono text-xs" : ""}`}>
                  {c.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
