import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DOCS, findDoc } from "@/components/site/docs-content";

export function generateStaticParams() {
  return DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: PageProps<"/docs/[slug]">): Promise<Metadata> {
  const doc = findDoc((await params).slug);
  return doc ? { title: `${doc.title} · Docs`, description: doc.description } : {};
}

const pagerCard =
  "focus-ring group flex flex-col gap-1 rounded-lg border border-gray-alpha-400 bg-background-100 px-4 py-3 transition-colors hover:border-gray-alpha-600";

export default async function DocPage({ params }: PageProps<"/docs/[slug]">) {
  const { slug } = await params;
  const doc = findDoc(slug);
  if (!doc) notFound();
  const i = DOCS.indexOf(doc);
  const prev = DOCS[i - 1];
  const next = DOCS[i + 1];

  return (
    <div className="grid gap-12 xl:grid-cols-[minmax(0,720px)_180px] xl:justify-between">
      <article className="min-w-0 max-w-[720px]">
        <p className="text-label-13 font-medium text-gray-900">{doc.group}</p>
        <h1 className="mt-2 text-heading-40 text-gray-1000">{doc.title}</h1>
        <p className="mt-4 text-copy-16 text-gray-900 md:text-copy-20">{doc.description}</p>
        {doc.sections.map((s) => (
          <section key={s.id} aria-labelledby={s.id} className="mt-12 border-t border-gray-alpha-400 pt-10">
            <h2 id={s.id} className="scroll-mt-24 text-heading-24 text-gray-1000">
              <a href={`#${s.id}`} className="focus-ring rounded-sm hover:underline hover:decoration-gray-alpha-500 hover:underline-offset-4">
                {s.title}
              </a>
            </h2>
            <div className="text-copy-16">{s.body}</div>
          </section>
        ))}
        <nav aria-label="Pagination" className="mt-16 grid gap-4 border-t border-gray-alpha-400 pt-8 sm:grid-cols-2">
          {prev ? (
            <Link href={`/docs/${prev.slug}`} className={pagerCard}>
              <span className="flex items-center gap-1 text-label-13 text-gray-900">
                <ChevronLeft className="size-3.5" aria-hidden /> Previous
              </span>
              <span className="text-label-14 font-medium text-gray-1000">{prev.title}</span>
            </Link>
          ) : (
            <span className="hidden sm:block" />
          )}
          {next && (
            <Link href={`/docs/${next.slug}`} className={`${pagerCard} items-end text-right`}>
              <span className="flex items-center gap-1 text-label-13 text-gray-900">
                Next <ChevronRight className="size-3.5" aria-hidden />
              </span>
              <span className="text-label-14 font-medium text-gray-1000">{next.title}</span>
            </Link>
          )}
        </nav>
      </article>
      <aside className="hidden xl:block">
        <nav aria-label="On this page" className="sticky top-28">
          <h2 className="text-label-13 font-medium text-gray-1000">On this page</h2>
          <ul className="mt-3 space-y-2.5">
            {doc.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="focus-ring rounded-sm text-label-13 text-gray-900 transition-colors hover:text-gray-1000">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </div>
  );
}
