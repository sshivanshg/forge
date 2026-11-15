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
    <nav aria-label="Documentation" className="space-y-6">
      {groups.map((g) => (
        <div key={g.group}>
          <h2 className="mb-1.5 px-2 text-label-13 font-medium text-gray-1000">{g.group}</h2>
          <ul className="space-y-px">
            {g.items.map((it) => {
              const href = `/docs/${it.slug}`;
              const active = pathname === href;
              return (
                <li key={it.slug}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "focus-ring block rounded-md px-2 py-1.5 text-label-14 transition-colors",
                      active ? "bg-gray-alpha-100 font-medium text-gray-1000" : "text-gray-900 hover:text-gray-1000",
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
