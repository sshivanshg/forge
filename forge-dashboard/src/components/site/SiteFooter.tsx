import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { GITHUB_URL } from "./links";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#features", label: "Features" },
      { href: "/#how-it-works", label: "How it works" },
      { href: "/login", label: "Sign in" },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/docs", label: "Docs" },
      { href: "/docs/api-reference", label: "API reference" },
      { href: "/architecture", label: "Architecture" },
    ],
  },
  {
    title: "Source",
    links: [
      { href: GITHUB_URL, label: "GitHub" },
      { href: `${GITHUB_URL}/blob/main/docs/DECISIONS.md`, label: "Decision log" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-white/[0.06] bg-ink-950">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-zinc-500">
            A cloud-native deployment and orchestration platform. Java 21, Spring Boot, PostgreSQL, Traefik.
          </p>
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">{c.title}</h2>
            <ul className="mt-3 space-y-2">
              {c.links.map((l) => (
                <li key={l.label}>
                  {l.href.startsWith("http") ? (
                    <a href={l.href} className="text-[13px] text-zinc-400 hover:text-zinc-100">
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href} className="text-[13px] text-zinc-400 hover:text-zinc-100">
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/[0.04]">
        <p className="mx-auto max-w-6xl px-4 py-5 font-mono text-[11px] text-zinc-600 sm:px-6">
          Forge · Scalable Cloud-Native Application Deployment and Orchestration Platform
        </p>
      </div>
    </footer>
  );
}
