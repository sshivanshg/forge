"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Logo } from "@/components/ui/Logo";
import { GithubIcon } from "@/components/ui/GithubIcon";
import { buttonClass } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";

import { GITHUB_URL } from "./links";

const NAV = [
  { href: "/docs", label: "Docs" },
  { href: "/architecture", label: "Architecture" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { status } = useAuth();
  const [open, setOpen] = useState(false);
  const signedIn = status === "authenticated" || status === "unreachable";

  const cta = signedIn ? (
    <Link href="/overview" className={buttonClass("primary", "sm")}>
      Dashboard
    </Link>
  ) : (
    <Link href="/login" className={buttonClass("primary", "sm")}>
      Sign in
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70" aria-label="Forge home">
          <Logo />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 sm:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={pathname.startsWith(n.href) ? "page" : undefined}
              className={cx(
                "rounded-md px-3 py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70",
                pathname.startsWith(n.href) ? "text-zinc-50" : "text-zinc-400 hover:text-zinc-100",
              )}
            >
              {n.label}
            </Link>
          ))}
          <a
            href={GITHUB_URL}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] text-zinc-400 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70"
          >
            <GithubIcon className="size-3.5" /> GitHub
          </a>
        </nav>
        <div className="ml-auto hidden sm:block">{cta}</div>
        <button
          type="button"
          className="ml-auto inline-flex size-9 items-center justify-center rounded-md text-zinc-300 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70 sm:hidden"
          aria-expanded={open}
          aria-controls="site-mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <nav id="site-mobile-nav" aria-label="Mobile" className="border-t border-white/[0.06] px-4 py-3 sm:hidden">
          <ul className="flex flex-col gap-1">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-white/[0.05]">
                  {n.label}
                </Link>
              </li>
            ))}
            <li>
              <a href={GITHUB_URL} className="block rounded-md px-3 py-2 text-sm text-zinc-300 hover:bg-white/[0.05]">
                GitHub
              </a>
            </li>
            <li className="pt-2">{cta}</li>
          </ul>
        </nav>
      )}
    </header>
  );
}
