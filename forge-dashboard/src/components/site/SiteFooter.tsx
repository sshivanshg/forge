import Link from "next/link";
import { LogoMark } from "@/components/ui/Logo";
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

const linkClass = "focus-ring rounded-sm text-label-14 text-gray-900 transition-colors hover:text-gray-1000";

export function SiteFooter() {
  return (
    <footer className="border-t border-gray-alpha-400 bg-background-200">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <LogoMark className="size-7" />
          <p className="mt-4 max-w-xs text-copy-14 text-gray-900">
            A cloud-native deployment and orchestration platform. Java 21, Spring Boot, PostgreSQL, Traefik.
          </p>
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="text-heading-14 text-gray-1000">{c.title}</h2>
            <ul className="mt-4 space-y-3">
              {c.links.map((l) => (
                <li key={l.label}>
                  {l.href.startsWith("http") ? (
                    <a href={l.href} className={linkClass}>
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href} className={linkClass}>
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-gray-alpha-400">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6">
          <p className="text-label-13 text-gray-900">Forge · Scalable Cloud-Native Application Deployment and Orchestration Platform</p>
          <p className="inline-flex items-center gap-2 text-label-13 text-gray-900">
            <span className="size-2 rounded-full bg-blue-700" aria-hidden />
            University SDE project · open source
          </p>
        </div>
      </div>
    </footer>
  );
}
