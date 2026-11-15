import { ChevronDown } from "lucide-react";
import { DOCS } from "@/components/site/docs-content";
import { DocsNav, type NavGroup } from "@/components/site/DocsNav";

const groups: NavGroup[] = [];
for (const d of DOCS) {
  let g = groups.find((x) => x.group === d.group);
  if (!g) groups.push((g = { group: d.group, items: [] }));
  g.items.push({ slug: d.slug, title: d.title });
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-[1200px] md:grid-cols-[240px_1fr]">
      <aside className="border-b border-gray-alpha-400 md:sticky md:top-16 md:h-[calc(100vh-4rem)] md:overflow-y-auto md:border-b-0 md:border-r">
        <details className="group px-4 py-3 sm:px-6 md:hidden">
          <summary className="focus-ring flex cursor-pointer list-none items-center justify-between rounded-md text-label-14 font-medium text-gray-1000 [&::-webkit-details-marker]:hidden">
            Browse the docs
            <ChevronDown className="size-4 text-gray-900 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="mt-4 pb-2">
            <DocsNav groups={groups} />
          </div>
        </details>
        <div className="scrollbar-thin hidden px-4 py-8 md:block">
          <DocsNav groups={groups} />
        </div>
      </aside>
      <div className="min-w-0 px-4 py-10 sm:px-6 md:px-10 md:py-12">{children}</div>
    </div>
  );
}
