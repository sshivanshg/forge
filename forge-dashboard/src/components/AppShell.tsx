"use client";

import { ChevronDown, LogOut, ServerCrash } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { Skeleton } from "@/components/ui/Skeleton";
import { cx } from "@/components/ui/cx";
import { API_URL } from "@/lib/api";

const NAV = [
  { href: "/projects", label: "Projects", match: ["/projects", "/deployments"] },
  { href: "/settings", label: "Settings", match: ["/settings"] },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function UserMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return <Skeleton className="size-8 rounded-full" />;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 text-zinc-300 transition-colors hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-violet-500/70 focus-visible:outline-none"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-zinc-600 to-zinc-800 text-[11px] font-semibold text-zinc-100 ring-1 ring-white/10">
          {initials(user.displayName)}
        </span>
        <span className="hidden max-w-[10rem] truncate text-[13px] sm:inline">{user.displayName}</span>
        <ChevronDown className="size-3.5 text-zinc-500" aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className="toast-in absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-lg border border-white/10 bg-zinc-900 shadow-2xl shadow-black/60"
        >
          <div className="border-b border-white/[0.06] px-3 py-2.5">
            <p className="truncate text-[13px] font-medium text-zinc-100">{user.displayName}</p>
            <p className="truncate text-xs text-zinc-500">{user.email}</p>
          </div>
          <button
            role="menuitem"
            type="button"
            autoFocus
            onClick={async () => {
              setOpen(false);
              await logout();
              router.replace("/login");
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-zinc-300 hover:bg-white/[0.05] focus-visible:bg-white/[0.05] focus-visible:outline-none"
          >
            <LogOut className="size-4 text-zinc-500" aria-hidden />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { status, retry } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, pathname, router]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/projects" className="rounded-md focus-visible:ring-2 focus-visible:ring-violet-500/70 focus-visible:outline-none" aria-label="Forge home">
            <Logo />
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1">
            {NAV.map((item) => {
              const active = item.match.some((m) => pathname.startsWith(m));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-violet-500/70 focus-visible:outline-none",
                    active ? "bg-white/[0.06] text-zinc-50" : "text-zinc-400 hover:text-zinc-100",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto">
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {status === "authenticated" ? (
          children
        ) : status === "unreachable" ? (
          <div className="mx-auto mt-16 max-w-md text-center">
            <ServerCrash className="mx-auto size-8 text-zinc-500" aria-hidden />
            <h1 className="mt-4 text-base font-semibold text-zinc-100">Can&apos;t reach the Forge API</h1>
            <p className="mt-1 text-[13px] text-zinc-500">
              The dashboard expects forge-server at <code className="font-mono text-zinc-300">{API_URL}</code>.
            </p>
            <Button className="mt-5" onClick={retry}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72" />
            <div className="grid gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-36 rounded-xl" />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
