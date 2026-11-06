"use client";

import { ArrowUpRight, Boxes, GitBranch, Layers, Plus, Split } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Sparkline } from "@/components/charts/Sparkline";
import { PageHeader } from "@/components/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { GithubIcon } from "@/components/ui/GithubIcon";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api";
import { formatDuration, relativeTime, shortSha } from "@/lib/format";
import { useQuery, useTick } from "@/lib/hooks";
import { deployDurationMs, median } from "@/lib/insights";
import { deploymentTitle } from "@/lib/status";
import type { Deployment, Project } from "@/lib/types";

/** Recent deployments per project id (newest first); missing = still loading. */
function useRecentDeployments(projects: Project[] | undefined) {
  const [recent, setRecent] = useState<Record<string, Deployment[]>>({});
  const ids = projects?.map((p) => p.id).join(",") ?? "";

  useEffect(() => {
    if (!ids) return;
    let cancelled = false;
    for (const id of ids.split(",")) {
      api.deployments.list(id, 0, 12).then(
        (page) => !cancelled && setRecent((m) => ({ ...m, [id]: page.content })),
        () => !cancelled && setRecent((m) => ({ ...m, [id]: [] })),
      );
    }
    return () => {
      cancelled = true;
    };
  }, [ids]);

  return recent;
}

function ProjectRow({ project, recent }: { project: Project; recent: Deployment[] | undefined }) {
  const latest = recent?.[0];
  const isLive = !!project.liveDeploymentId;
  const host = project.liveUrl.replace(/^https?:\/\//, "");
  const durations = (recent ?? []).map(deployDurationMs).reverse();
  const med = median(durations.filter((v): v is number => v !== null));

  return (
    <li className="group relative grid grid-cols-1 gap-3 px-4 py-4 transition-colors hover:bg-white/[0.02] md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_auto_7rem] md:items-center md:gap-6 md:px-5">
      {/* Identity */}
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-ink-800 font-mono text-sm font-semibold text-zinc-200">
          {project.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/projects/${project.id}`}
              className="truncate text-[14px] font-semibold text-zinc-100 after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-brand-500/70 focus-visible:after:ring-inset"
            >
              {project.name}
            </Link>
            {recent === undefined ? (
              <Skeleton className="h-5 w-16 rounded-full" />
            ) : latest ? (
              <StatusBadge status={latest.status} />
            ) : (
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-zinc-500">Not deployed</span>
            )}
          </div>
          {isLive ? (
            <a
              href={project.liveUrl}
              target="_blank"
              rel="noreferrer"
              className="relative z-10 mt-0.5 inline-flex max-w-full items-center gap-1 font-mono text-xs text-emerald-400/90 hover:text-emerald-300 hover:underline focus-visible:underline focus-visible:outline-none"
            >
              <span className="truncate">{host}</span>
              <ArrowUpRight className="size-3 shrink-0" aria-hidden />
            </a>
          ) : (
            <p className="mt-0.5 truncate font-mono text-xs text-zinc-600">{host}</p>
          )}
        </div>
      </div>

      {/* Last deploy */}
      <div className="min-w-0 text-[13px] md:pl-0">
        {recent === undefined ? (
          <Skeleton className="h-4 w-3/4" />
        ) : latest ? (
          <>
            <p className="truncate text-zinc-300">{deploymentTitle(latest)}</p>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
              <span className="font-mono text-zinc-400">{shortSha(latest.commitSha)}</span>
              <GitBranch className="size-3" aria-hidden />
              <span className="truncate font-mono">{project.branch}</span>
              <span>· {relativeTime(latest.createdAt)}</span>
            </p>
          </>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-zinc-500">
            <GithubIcon className="size-3.5" />
            {project.repoOwner}/{project.repoName}
          </p>
        )}
      </div>

      {/* Topology */}
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <span className="inline-flex items-center gap-1 rounded border border-white/[0.08] px-1.5 py-0.5" title="Replicas">
          <Layers className="size-3 text-zinc-500" aria-hidden />
          <span className="font-mono tabular">{project.replicas ?? 1}×</span>
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 ${project.rollout === "CANARY" ? "border-cyan-500/25 text-cyan-300" : "border-white/[0.08]"}`}
          title="Rollout mode"
        >
          <Split className="size-3" aria-hidden />
          {project.rollout === "CANARY" ? "Canary" : "Blue-green"}
        </span>
      </div>

      {/* Durations */}
      <div className="hidden md:block" title="Recent deploy durations">
        {durations.filter((v) => v !== null).length > 1 ? (
          <>
            <Sparkline values={durations} className="h-6 w-full" tone="text-brand-400" />
            <p className="mt-1 text-right font-mono text-[10px] text-zinc-500 tabular">p50 {med !== null ? formatDuration(med) : "—"}</p>
          </>
        ) : (
          <p className="text-right font-mono text-[10px] text-zinc-600">{recent === undefined ? "" : "not enough data"}</p>
        )}
      </div>
    </li>
  );
}

export default function ProjectsPage() {
  const projects = useQuery("projects", () => api.projects.list(0, 100));
  const recent = useRecentDeployments(projects.data?.content);
  useTick(30_000);
  const list = projects.data?.content;

  return (
    <>
      <PageHeader
        title="Projects"
        description={list ? `${list.length} ${list.length === 1 ? "project" : "projects"} · ${list.filter((p) => p.liveDeploymentId).length} live` : "Loading…"}
        actions={
          <ButtonLink href="/projects/new" variant="primary" size="sm" icon={<Plus className="size-4" aria-hidden />}>
            New project
          </ButtonLink>
        }
      />

      {projects.error && !list ? (
        <Alert action={<Button size="sm" onClick={projects.reload}>Retry</Button>}>{projects.error.message}</Alert>
      ) : !list ? (
        <div className="divide-y divide-white/[0.05] rounded-lg border border-white/[0.07] bg-ink-900">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-5">
              <Skeleton className="size-9" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64" />
              </div>
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Boxes className="size-5" aria-hidden />}
          title="No projects yet"
          description="Point Forge at a GitHub repository. It detects how to build it, ships it to a live URL and explains any failure."
          action={
            <ButtonLink href="/projects/new" variant="primary" icon={<Plus className="size-4" aria-hidden />}>
              Create your first project
            </ButtonLink>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-white/[0.07] bg-ink-900">
          <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_auto_7rem] gap-6 border-b border-white/[0.06] px-5 py-2 text-[11px] font-medium tracking-wide text-zinc-600 uppercase md:grid">
            <span>Project</span>
            <span>Last deploy</span>
            <span>Topology</span>
            <span className="text-right">Build time</span>
          </div>
          <ul className="divide-y divide-white/[0.05]">
            {list.map((p) => (
              <ProjectRow key={p.id} project={p} recent={recent[p.id]} />
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
