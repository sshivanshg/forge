"use client";

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
      <ol className="flex min-w-0 items-center gap-1 text-label-14">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={i} className={last ? "flex min-w-0 items-center gap-1" : "hidden min-w-0 items-center gap-1 sm:flex"}>
              {i > 0 && (
                <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-gray-alpha-500" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                  <path d="M16.88 3.549 7.12 20.451" />
                </svg>
              )}
              {c.href && !last ? (
                <Link
                  href={c.href}
                  className={`truncate rounded-md px-1.5 py-1 text-gray-900 hover:bg-gray-alpha-200 hover:text-gray-1000 focus-ring ${c.mono ? "font-mono text-label-13" : ""}`}
                >
                  {c.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={`truncate px-1.5 font-medium text-gray-1000 ${c.mono ? "font-mono text-label-13" : ""}`}>
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
