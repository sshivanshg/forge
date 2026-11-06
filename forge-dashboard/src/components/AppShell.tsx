"use client";

import { Activity, Boxes, ChevronsUpDown, LayoutGrid, LogOut, Menu, Plus, Search, ServerCrash, Settings, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Breadcrumbs, BreadcrumbProvider } from "@/components/shell/Breadcrumbs";
import { CommandPaletteProvider, useCommandPalette } from "@/components/shell/CommandPalette";
import { Button, ButtonLink } from "@/components/ui/Button";
import { LogoMark } from "@/components/ui/Logo";
import { Skeleton } from "@/components/ui/Skeleton";
import { cx } from "@/components/ui/cx";
import { API_URL, api } from "@/lib/api";

const NAV = [
  { href: "/overview", label: "Overview", icon: LayoutGrid, match: ["/overview"] },
  { href: "/projects", label: "Projects", icon: Boxes, match: ["/projects", "/deployments"] },
  { href: "/activity", label: "Activity", icon: Activity, match: ["/activity"] },
  { href: "/settings", label: "Settings", icon: Settings, match: ["/settings"] },
];

const focusRing = "focus-visible:ring-2 focus-visible:ring-brand-500/70 focus-visible:outline-none";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Polls the control plane's actuator health every 15 s. */
function useBackendHealth() {
  const [up, setUp] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    const check = () => api.health().then((ok) => alive && setUp(ok));
    check();
    const t = window.setInterval(check, 15_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);
  return up;
}

function HealthDot() {
  const up = useBackendHealth();
  const label = up === null ? "Checking control plane" : up ? "Control plane healthy" : "Control plane unreachable";
  return (
    <span className="flex items-center gap-2 px-2.5 text-[11px] text-zinc-500" title={API_URL}>
      <span className="relative inline-flex size-1.5">
        {up && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-50" />}
        <span className={cx("relative size-1.5 rounded-full", up === null ? "bg-zinc-500" : up ? "bg-emerald-400" : "bg-red-400")} />
      </span>
      <span className="truncate">{label}</span>
    </span>
  );
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
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return <Skeleton className="h-10 w-full" />;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cx("flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/[0.05]", focusRing)}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink-700 text-[11px] font-semibold text-zinc-200 ring-1 ring-white/10">
          {initials(user.displayName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-zinc-200">{user.displayName}</span>
          <span className="block truncate text-[11px] text-zinc-500">{user.email}</span>
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-zinc-600" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="toast-in absolute bottom-full left-0 z-40 mb-2 w-full overflow-hidden rounded-lg border border-white/10 bg-ink-850 shadow-2xl shadow-black/60">
          <Link role="menuitem" href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 text-[13px] text-zinc-300 hover:bg-white/[0.05] focus-visible:bg-white/[0.05] focus-visible:outline-none">
            <Settings className="size-4 text-zinc-500" aria-hidden /> Account settings
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={async () => {
              setOpen(false);
              await logout();
              router.replace("/login");
            }}
            className="flex w-full items-center gap-2 border-t border-white/[0.06] px-3 py-2 text-left text-[13px] text-zinc-300 hover:bg-white/[0.05] focus-visible:bg-white/[0.05] focus-visible:outline-none"
          >
            <LogOut className="size-4 text-zinc-500" aria-hidden /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const { user } = useAuth();
  const palette = useCommandPalette();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2.5 border-b border-white/[0.06] px-3.5">
        <Link href="/overview" onClick={onNavigate} className={cx("flex min-w-0 flex-1 items-center gap-2.5 rounded-md", focusRing)} aria-label="Forge overview">
          <LogoMark className="size-7 shrink-0" />
          <span className="min-w-0 leading-tight">
            <span className="block text-[13px] font-semibold tracking-tight text-zinc-50">Forge</span>
            <span className="block truncate text-[11px] text-zinc-500">{user ? `${user.displayName.split(" ")[0]}'s workspace` : "Workspace"}</span>
          </span>
        </Link>
      </div>

      <div className="px-3 pt-3">
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            palette.open();
          }}
          className={cx("flex h-8 w-full items-center gap-2 rounded-md border border-white/[0.07] bg-white/[0.02] px-2.5 text-[13px] text-zinc-500 transition-colors hover:border-white/15 hover:text-zinc-300", focusRing)}
        >
          <Search className="size-3.5" aria-hidden />
          Search
          <kbd className="ml-auto font-mono text-[10px] text-zinc-600">⌘K</kbd>
        </button>
      </div>

      <nav aria-label="Main" className="flex-1 px-3 pt-4">
        <p className="px-2.5 pb-1.5 text-[11px] font-medium tracking-wide text-zinc-600 uppercase">Platform</p>
        <ul className="space-y-0.5">
          {NAV.map(({ href, label, icon: Icon, match }) => {
            const active = match.some((m) => pathname.startsWith(m));
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
                    focusRing,
                    active ? "bg-white/[0.06] text-zinc-50" : "text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-100",
                  )}
                >
                  {active && <span className="absolute top-1.5 bottom-1.5 -left-3 w-0.5 rounded-r bg-brand-500" aria-hidden />}
                  <Icon className={cx("size-4", active ? "text-brand-400" : "text-zinc-500")} aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
        <ButtonLink href="/projects/new" onClick={onNavigate} size="sm" variant="ghost" className="mt-4 w-full justify-start px-2.5 text-zinc-400" icon={<Plus className="size-4" aria-hidden />}>
          New project
        </ButtonLink>
      </nav>

      <div className="space-y-2 border-t border-white/[0.06] p-3">
        <HealthDot />
        <UserMenu />
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { status, retry } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const palette = useCommandPalette();
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, pathname, router]);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer]);

  return (
    <div className="min-h-screen bg-ink-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-white/[0.06] bg-ink-900 lg:block">
        <SidebarContent pathname={pathname} />
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawer(false)} aria-hidden />
          <aside className="toast-in absolute inset-y-0 left-0 w-64 border-r border-white/[0.08] bg-ink-900">
            <button type="button" onClick={() => setDrawer(false)} aria-label="Close navigation" className={cx("absolute top-4 right-3 rounded p-1 text-zinc-500 hover:text-zinc-200", focusRing)}>
              <X className="size-4" />
            </button>
            <SidebarContent pathname={pathname} onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-white/[0.06] bg-ink-950/85 px-4 backdrop-blur-md sm:px-6">
          <button type="button" onClick={() => setDrawer(true)} aria-label="Open navigation" className={cx("-ml-1 rounded-md p-1.5 text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100 lg:hidden", focusRing)}>
            <Menu className="size-5" />
          </button>
          <Breadcrumbs pathname={pathname} />
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={palette.open}
              aria-label="Open command palette"
              className={cx("flex h-8 items-center gap-2 rounded-md border border-white/[0.07] px-2.5 text-[13px] text-zinc-500 hover:border-white/15 hover:text-zinc-300", focusRing)}
            >
              <Search className="size-3.5" aria-hidden />
              <kbd className="hidden font-mono text-[10px] sm:inline">⌘K</kbd>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">
          {status === "authenticated" ? (
            children
          ) : status === "unreachable" ? (
            <div className="mx-auto mt-16 max-w-md rounded-xl border border-white/[0.08] bg-ink-900 p-8 text-center">
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
              <div className="grid gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <BreadcrumbProvider>
      <CommandPaletteProvider>
        <Shell>{children}</Shell>
      </CommandPaletteProvider>
    </BreadcrumbProvider>
  );
}
