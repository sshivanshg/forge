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

  const actions = signedIn ? (
    <Link href="/overview" className={buttonClass("primary", "sm")}>
      Dashboard
    </Link>
  ) : (
    <>
      <Link href="/login" className={buttonClass("secondary", "sm")}>
        Log in
      </Link>
      <Link href="/login" className={buttonClass("primary", "sm")}>
        Try the demo
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-gray-alpha-400 bg-background-100">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="focus-ring rounded-md" aria-label="Forge home">
          <Logo />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 sm:flex">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "focus-ring rounded-md px-2.5 py-1.5 text-label-14 transition-colors",
                  active ? "text-gray-1000" : "text-gray-900 hover:text-gray-1000",
                )}
              >
                {n.label}
              </Link>
            );
          })}
          <a
            href={GITHUB_URL}
            className="focus-ring inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-label-14 text-gray-900 transition-colors hover:text-gray-1000"
          >
            <GithubIcon className="size-3.5" /> GitHub
          </a>
        </nav>
        <div className="ml-auto hidden items-center gap-2 sm:flex">{actions}</div>
        <button
          type="button"
          className="focus-ring ml-auto inline-flex size-9 items-center justify-center rounded-md text-gray-1000 shadow-border hover:bg-gray-alpha-200 sm:hidden"
          aria-expanded={open}
          aria-controls="site-mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </div>
      {open && (
        <nav id="site-mobile-nav" aria-label="Mobile" className="border-t border-gray-alpha-400 bg-background-100 px-4 py-3 sm:hidden">
          <ul className="flex flex-col">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="focus-ring block rounded-md px-2 py-2.5 text-label-14 text-gray-1000 hover:bg-gray-alpha-100"
                >
                  {n.label}
                </Link>
              </li>
            ))}
            <li>
              <a href={GITHUB_URL} className="focus-ring block rounded-md px-2 py-2.5 text-label-14 text-gray-1000 hover:bg-gray-alpha-100">
                GitHub
              </a>
            </li>
            <li className="mt-2 flex gap-2 border-t border-gray-alpha-400 pt-3 [&>a]:flex-1">{actions}</li>
          </ul>
        </nav>
      )}
    </header>
  );
}
