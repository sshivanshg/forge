"use client";

import { Activity, ArrowRight, Boxes, LayoutGrid, LogOut, Plus, Rocket, Search, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/components/AuthProvider";
import { StatusDot } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { cx } from "@/components/ui/cx";
import { api, errorMessage } from "@/lib/api";
import { relativeTime, shortSha } from "@/lib/format";
import { fetchActivity } from "@/lib/insights";
import { deploymentTitle } from "@/lib/status";
import type { ActivityItem, Project } from "@/lib/types";

interface Command {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  keywords?: string;
  run: () => void | Promise<void>;
}

const PaletteCtx = createContext<{ open: () => void }>({ open: () => undefined });
export const useCommandPalette = () => useContext(PaletteCtx);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo(() => ({ open: () => setOpen(true) }), []);
  return (
    <PaletteCtx.Provider value={value}>
      {children}
      {open && <Palette onClose={() => setOpen(false)} />}
    </PaletteCtx.Provider>
  );
}

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const { logout } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const [recent, setRecent] = useState<ActivityItem[]>([]);

  useEffect(() => {
    dialog.current?.showModal();
    api.projects.list(0, 100).then((p) => setProjects(p.content), () => undefined);
    fetchActivity(8).then(setRecent, () => undefined);
  }, []);

  const go = useCallback(
    (href: string) => () => {
      onClose();
      router.push(href);
    },
    [onClose, router],
  );

  const commands = useMemo<Command[]>(() => {
    const icon = (I: typeof Boxes) => <I className="size-4" aria-hidden />;
    const cmds: Command[] = [
      { id: "nav-overview", group: "Navigate", label: "Overview", icon: icon(LayoutGrid), run: go("/overview") },
      { id: "nav-projects", group: "Navigate", label: "Projects", icon: icon(Boxes), run: go("/projects") },
      { id: "nav-activity", group: "Navigate", label: "Activity", icon: icon(Activity), run: go("/activity") },
      { id: "nav-settings", group: "Navigate", label: "Settings", icon: icon(Settings), run: go("/settings") },
      { id: "new-project", group: "Actions", label: "New project", icon: icon(Plus), keywords: "create add", run: go("/projects/new") },
    ];
    for (const p of projects) {
      cmds.push({
        id: `deploy-${p.id}`,
        group: "Actions",
        label: `Deploy ${p.name}`,
        hint: p.branch,
        icon: icon(Rocket),
        keywords: p.slug,
        run: async () => {
          onClose();
          try {
            const d = await api.deployments.create(p.id);
            toast.success(`Deploying ${p.name}`);
            router.push(`/deployments/${d.id}`);
          } catch (err) {
            toast.error("Couldn't start a deployment", errorMessage(err));
          }
        },
      });
    }
    for (const p of projects) {
      cmds.push({
        id: `project-${p.id}`,
        group: "Projects",
        label: p.name,
        hint: p.slug,
        icon: <span className="flex size-4 items-center justify-center rounded-[4px] bg-ink-700 text-[10px] font-semibold text-zinc-300">{p.name[0]?.toUpperCase()}</span>,
        keywords: `${p.repoOwner}/${p.repoName}`,
        run: go(`/projects/${p.id}`),
      });
    }
    for (const d of recent) {
      cmds.push({
        id: `dep-${d.id}`,
        group: "Recent deployments",
        label: `${d.projectName} · ${deploymentTitle(d)}`,
        hint: `${shortSha(d.commitSha)} · ${relativeTime(d.createdAt)}`,
        icon: (
          <span className="flex size-4 items-center justify-center">
            <StatusDot status={d.status} />
          </span>
        ),
        keywords: `${d.id} ${d.commitSha ?? ""}`,
        run: go(`/deployments/${d.id}`),
      });
    }
    cmds.push({
      id: "sign-out",
      group: "Account",
      label: "Sign out",
      icon: icon(LogOut),
      keywords: "logout log out",
      run: async () => {
        onClose();
        await logout();
        router.replace("/login");
      },
    });
    return cmds;
  }, [projects, recent, go, onClose, logout, router, toast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands.filter((c) => !c.id.startsWith("deploy-") || projects.length <= 3);
    return commands.filter((c) => `${c.label} ${c.hint ?? ""} ${c.keywords ?? ""}`.toLowerCase().includes(q));
  }, [commands, query, projects.length]);

  const sel = Math.min(active, Math.max(filtered.length - 1, 0));

  useEffect(() => {
    list.current?.querySelector(`[data-index="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((sel + 1) % Math.max(filtered.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((sel - 1 + filtered.length) % Math.max(filtered.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[sel]?.run();
    }
  };

  let lastGroup = "";

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
      aria-label="Command palette"
      className="mx-auto mt-[12vh] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-xl border border-white/10 bg-ink-900 p-0 text-zinc-100 shadow-2xl shadow-black/70 backdrop:bg-black/60 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex items-center gap-3 border-b border-white/[0.07] px-4">
        <Search className="size-4 shrink-0 text-zinc-500" aria-hidden />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Jump to a project, deployment or action…"
          role="combobox"
          aria-expanded
          aria-controls="palette-list"
          aria-activedescendant={filtered[sel] ? `cmd-${filtered[sel].id}` : undefined}
          className="h-12 flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
        />
        <kbd className="hidden rounded border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 sm:block">ESC</kbd>
      </div>
      <ul id="palette-list" ref={list} role="listbox" className="scrollbar-thin max-h-[min(60vh,420px)] overflow-y-auto p-1.5">
        {filtered.length === 0 && <li className="px-3 py-8 text-center text-[13px] text-zinc-500">No matches for “{query}”</li>}
        {filtered.map((c, i) => {
          const header = c.group !== lastGroup ? c.group : null;
          lastGroup = c.group;
          return (
            <li key={c.id} role="presentation">
              {header && <p className="px-2.5 pt-2.5 pb-1 text-[11px] font-medium tracking-wide text-zinc-600 uppercase">{header}</p>}
              <div
                id={`cmd-${c.id}`}
                role="option"
                aria-selected={i === sel}
                data-index={i}
                onMouseMove={() => setActive(i)}
                onClick={() => c.run()}
                className={cx(
                  "flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-[13px]",
                  i === sel ? "bg-white/[0.07] text-zinc-50" : "text-zinc-300",
                )}
              >
                <span className={i === sel ? "text-brand-400" : "text-zinc-500"}>{c.icon}</span>
                <span className="min-w-0 flex-1 truncate">{c.label}</span>
                {c.hint && <span className="hidden max-w-[40%] truncate font-mono text-[11px] text-zinc-500 sm:block">{c.hint}</span>}
                {i === sel && <ArrowRight className="size-3.5 shrink-0 text-zinc-500" aria-hidden />}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-4 border-t border-white/[0.07] px-4 py-2 font-mono text-[10px] text-zinc-600">
        <span>↑↓ navigate</span>
        <span>↵ select</span>
        <span className="ml-auto">⌘K toggle</span>
      </div>
    </dialog>
  );
}
