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
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 md:grid-cols-[200px_1fr]">
      <aside className="md:sticky md:top-20 md:h-[calc(100vh-6rem)] md:overflow-y-auto">
        <details className="rounded-lg border border-white/[0.08] p-3 md:hidden">
          <summary className="cursor-pointer text-sm text-zinc-300">Browse the docs</summary>
          <div className="mt-4">
            <DocsNav groups={groups} />
          </div>
        </details>
        <div className="hidden md:block">
          <DocsNav groups={groups} />
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
