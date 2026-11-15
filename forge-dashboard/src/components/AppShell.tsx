"use client";

import { LogOut, Monitor, Moon, Plus, Search, ServerCrash, Settings, Sun } from "lucide-react";
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
import { useTheme, type ThemePref } from "@/lib/theme";

const NAV = [
  { href: "/overview", label: "Overview", match: ["/overview"] },
  { href: "/projects", label: "Projects", match: ["/projects", "/deployments"] },
  { href: "/activity", label: "Activity", match: ["/activity"] },
  { href: "/settings", label: "Settings", match: ["/settings"] },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Vercel's scope separator: a thin forward slash. */
function Slash() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-gray-alpha-500" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M16.88 3.549 7.12 20.451" />
    </svg>
  );
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

function HealthIndicator() {
  const up = useBackendHealth();
  const label = up === null ? "Checking" : up ? "All systems normal" : "API unreachable";
  return (
    <span className="hidden items-center gap-2 text-label-13 text-gray-900 md:flex" title={`Control plane: ${API_URL}`}>
      <span className={cx("size-2 rounded-full", up === null ? "bg-gray-700" : up ? "bg-blue-700" : "bg-red-700")} aria-hidden />
      {label}
    </span>
  );
}

const THEMES: { id: ThemePref; label: string; icon: typeof Sun }[] = [
  { id: "system", label: "System", icon: Monitor },
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
];

function ThemeSwitch() {
  const { pref, set } = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className="flex rounded-full border border-gray-alpha-400 p-0.5">
      {THEMES.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={pref === id}
          aria-label={label}
          title={label}
          onClick={() => set(id)}
          className={cx(
            "flex size-6 items-center justify-center rounded-full transition-colors focus-ring",
            pref === id ? "bg-gray-alpha-300 text-gray-1000" : "text-gray-900 hover:text-gray-1000",
          )}
        >
          <Icon className="size-3.5" aria-hidden />
        </button>
      ))}
    </div>
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

  if (!user) return <Skeleton className="size-8 rounded-full" />;

  const item = "flex h-10 w-full items-center justify-between gap-2 rounded-md px-2 text-label-14 text-gray-900 transition-colors hover:bg-gray-alpha-100 hover:text-gray-1000 focus-ring";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-700 to-purple-700 text-[11px] font-semibold text-white focus-ring"
      >
        {initials(user.displayName)}
      </button>
      {open && (
        <div role="menu" className="toast-in absolute top-full right-0 z-40 mt-2 w-64 rounded-xl bg-background-100 p-2 shadow-menu">
          <div className="px-2 pt-1 pb-3">
            <p className="truncate text-label-14 font-medium text-gray-1000">{user.displayName}</p>
            <p className="truncate text-label-13 text-gray-900">{user.email}</p>
          </div>
          <Link role="menuitem" href="/settings" onClick={() => setOpen(false)} className={item}>
            Account Settings <Settings className="size-4" aria-hidden />
          </Link>
          <div className={cx(item, "hover:bg-transparent")}>
            Theme <ThemeSwitch />
          </div>
          <div className="my-2 h-px bg-gray-alpha-400" />
          <button
            role="menuitem"
            type="button"
            onClick={async () => {
              setOpen(false);
              await logout();
              router.replace("/login");
            }}
            className={item}
          >
            Log Out <LogOut className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}

function TopBar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const palette = useCommandPalette();

  return (
    <>
      <header className="flex h-16 items-center gap-2 bg-background-100 px-4 sm:px-6">
        <Link href="/overview" aria-label="Forge overview" className="shrink-0 rounded-md focus-ring">
          <LogoMark className="size-6" />
        </Link>
        <Slash />
        <Link href="/overview" className="hidden min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-label-14 font-medium text-gray-1000 hover:bg-gray-alpha-200 focus-ring sm:flex">
          <span className="size-5 shrink-0 rounded-full bg-gradient-to-br from-teal-700 to-blue-700" aria-hidden />
          <span className="truncate">{user ? `${user.displayName.split(" ")[0]}'s projects` : "Workspace"}</span>
        </Link>
        <span className="hidden sm:contents">
          <Slash />
        </span>
        <Breadcrumbs pathname={pathname} />

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <HealthIndicator />
          <button
            type="button"
            onClick={palette.open}
            aria-label="Search (⌘K)"
            className="flex h-8 items-center gap-2 rounded-md border border-gray-alpha-400 bg-background-100 pr-1.5 pl-2.5 text-label-14 text-gray-900 transition-colors hover:bg-gray-alpha-100 focus-ring"
          >
            <Search className="size-4" aria-hidden />
            <span className="hidden lg:inline">Find…</span>
            <kbd className="hidden h-5 items-center rounded border border-gray-alpha-400 px-1.5 font-sans text-label-12 text-gray-900 sm:flex">⌘K</kbd>
          </button>
          <ButtonLink href="/projects/new" variant="primary" size="sm" icon={<Plus className="size-4" aria-hidden />} className="hidden sm:inline-flex">
            New Project
          </ButtonLink>
          <UserMenu />
        </div>
      </header>
      <nav aria-label="Main" className="sticky top-0 z-20 flex gap-1 overflow-x-auto border-b border-gray-alpha-400 bg-background-100 px-2 sm:px-4">
        {NAV.map(({ href, label, match }) => {
          const active = match.some((m) => pathname.startsWith(m));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cx("group relative flex h-12 shrink-0 items-center rounded-sm px-1 text-label-14 transition-colors focus-ring", active ? "text-gray-1000" : "text-gray-900 hover:text-gray-1000")}
            >
              <span className="rounded-md px-2 py-1 transition-colors group-hover:bg-gray-alpha-200">{label}</span>
              {active && <span className="absolute inset-x-1 bottom-0 h-0.5 bg-gray-1000" aria-hidden />}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { status, retry } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, pathname, router]);

  return (
    <div className="min-h-screen bg-background-200">
      <TopBar />
      <main className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10">
        {status === "authenticated" ? (
          children
        ) : status === "unreachable" ? (
          <div className="mx-auto mt-16 max-w-md rounded-lg border border-gray-alpha-400 bg-background-100 p-8 text-center">
            <ServerCrash className="mx-auto size-6 text-gray-900" aria-hidden />
            <h1 className="mt-4 text-heading-20 text-gray-1000">Can&apos;t reach the Forge API</h1>
            <p className="mt-2 text-copy-14 text-gray-900">
              The dashboard expects forge-server at <code className="font-mono text-label-13 text-gray-1000">{API_URL}</code>.
            </p>
            <Button className="mt-6" onClick={retry}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Skeleton className="h-10 w-56" />
            <Skeleton className="h-4 w-72" />
            <div className="grid gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 rounded-lg" />
              ))}
            </div>
          </div>
        )}
      </main>
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
