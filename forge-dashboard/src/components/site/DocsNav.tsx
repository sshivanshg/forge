"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui/cx";

export interface NavGroup {
  group: string;
  items: { slug: string; title: string }[];
}

export function DocsNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Documentation">
      {groups.map((g) => (
        <div key={g.group} className="mb-6">
          <h2 className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-zinc-500">{g.group}</h2>
          <ul className="space-y-0.5 border-l border-white/[0.06]">
            {g.items.map((it) => {
              const href = `/docs/${it.slug}`;
              const active = pathname === href;
              return (
                <li key={it.slug}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "-ml-px block border-l py-1.5 pl-3 text-[13.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70",
                      active ? "border-brand-500 text-zinc-50" : "border-transparent text-zinc-400 hover:border-white/20 hover:text-zinc-200",
                    )}
                  >
                    {it.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
