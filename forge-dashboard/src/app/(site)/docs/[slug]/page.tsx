import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { DOCS, findDoc } from "@/components/site/docs-content";

export function generateStaticParams() {
  return DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: PageProps<"/docs/[slug]">): Promise<Metadata> {
  const doc = findDoc((await params).slug);
  return doc ? { title: `${doc.title} · Docs`, description: doc.description } : {};
}

export default async function DocPage({ params }: PageProps<"/docs/[slug]">) {
  const { slug } = await params;
  const doc = findDoc(slug);
  if (!doc) notFound();
  const i = DOCS.indexOf(doc);
  const prev = DOCS[i - 1];
  const next = DOCS[i + 1];

  return (
    <div className="grid gap-10 xl:grid-cols-[1fr_180px]">
      <article className="min-w-0 max-w-3xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-brand-400">{doc.group}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50">{doc.title}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">{doc.description}</p>
        {doc.sections.map((s) => (
          <section key={s.id} aria-labelledby={s.id} className="mt-10">
            <h2 id={s.id} className="group scroll-mt-20 text-xl font-semibold tracking-tight text-zinc-100">
              <a href={`#${s.id}`} className="hover:text-brand-200">
                {s.title}
              </a>
            </h2>
            <div className="text-[15px]">{s.body}</div>
          </section>
        ))}
        <nav aria-label="Pagination" className="mt-16 grid grid-cols-2 gap-4 border-t border-white/[0.06] pt-6">
          {prev ? (
            <Link href={`/docs/${prev.slug}`} className="group rounded-lg p-2 text-[13px] text-zinc-400 hover:text-zinc-100">
              <span className="flex items-center gap-1 text-zinc-600">
                <ArrowLeft className="size-3.5" aria-hidden /> Previous
              </span>
              {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={`/docs/${next.slug}`} className="rounded-lg p-2 text-right text-[13px] text-zinc-400 hover:text-zinc-100">
              <span className="flex items-center justify-end gap-1 text-zinc-600">
                Next <ArrowRight className="size-3.5" aria-hidden />
              </span>
              {next.title}
            </Link>
          )}
        </nav>
      </article>
      <aside className="hidden xl:block">
        <nav aria-label="On this page" className="sticky top-20">
          <h2 className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-zinc-500">On this page</h2>
          <ul className="mt-3 space-y-2">
            {doc.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-[13px] text-zinc-400 hover:text-zinc-100">
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
