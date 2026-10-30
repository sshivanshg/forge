"use client";

import { ArrowUpRight, Boxes, GitBranch, Plus } from "lucide-react";
import { GithubIcon } from "@/components/ui/GithubIcon";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { useQuery, useTick } from "@/lib/hooks";
import type { Deployment, Project } from "@/lib/types";

/** Latest deployment per project id; `null` = never deployed, missing = still loading. */
function useLatestDeployments(projects: Project[] | undefined) {
  const [latest, setLatest] = useState<Record<string, Deployment | null>>({});
  const ids = projects?.map((p) => p.id).join(",") ?? "";

  useEffect(() => {
    if (!ids) return;
    let cancelled = false;
    for (const id of ids.split(",")) {
      api.deployments.list(id, 0, 1).then(
        (page) => {
          if (!cancelled) setLatest((m) => ({ ...m, [id]: page.content[0] ?? null }));
        },
        () => {
          if (!cancelled) setLatest((m) => ({ ...m, [id]: null }));
        },
      );
    }
    return () => {
      cancelled = true;
    };
  }, [ids]);

  return latest;
}

function ProjectCard({ project, latest }: { project: Project; latest: Deployment | null | undefined }) {
  const isLive = !!project.liveDeploymentId;
  const host = project.liveUrl.replace(/^https?:\/\//, "");
  return (
    <div className="group relative flex flex-col rounded-xl border border-white/[0.08] bg-zinc-900/40 p-5 transition-colors hover:border-white/[0.16] hover:bg-zinc-900/70">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br from-zinc-800 to-zinc-900 text-sm font-semibold text-zinc-200">
            {project.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <Link
              href={`/projects/${project.id}`}
              className="block truncate text-[15px] font-semibold text-zinc-100 after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-violet-500/70"
            >
              {project.name}
            </Link>
            <p className="truncate font-mono text-xs text-zinc-500">{project.slug}</p>
          </div>
        </div>
        {latest === undefined ? (
          <Skeleton className="h-5 w-20 rounded-full" />
        ) : latest ? (
          <StatusBadge status={latest.status} />
        ) : (
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-zinc-500">Not deployed</span>
        )}
      </div>

      <div className="mt-5 space-y-2 text-[13px]">
        <p className="flex items-center gap-2 text-zinc-400">
          <GithubIcon className="size-3.5 shrink-0 text-zinc-500" />
          <span className="truncate">
            {project.repoOwner}/{project.repoName}
          </span>
          <GitBranch className="ml-1 size-3.5 shrink-0 text-zinc-500" aria-hidden />
          <span className="truncate font-mono text-xs">{project.branch}</span>
        </p>
        {isLive ? (
          <a
            href={project.liveUrl}
            target="_blank"
            rel="noreferrer"
            className="relative z-10 inline-flex max-w-full items-center gap-1 truncate text-emerald-400 hover:text-emerald-300 hover:underline focus-visible:underline focus-visible:outline-none"
          >
            <span className="truncate">{host}</span>
            <ArrowUpRight className="size-3.5 shrink-0" aria-hidden />
          </a>
        ) : (
          <p className="text-zinc-600">No live URL yet</p>
        )}
      </div>

      <p className="mt-auto pt-5 text-xs text-zinc-500">
        {latest ? `Last deployed ${relativeTime(latest.createdAt)}` : `Created ${relativeTime(project.createdAt)}`}
      </p>
    </div>
  );
}

export default function ProjectsPage() {
  const projects = useQuery("projects", () => api.projects.list(0, 100));
  const latest = useLatestDeployments(projects.data?.content);
  useTick(30_000);

  const list = projects.data?.content;

  return (
    <>
      <PageHeader
        title="Projects"
        description="Every project is a GitHub repo Forge builds, ships and keeps healthy."
        actions={
          <ButtonLink href="/projects/new" variant="primary" icon={<Plus className="size-4" aria-hidden />}>
            New project
          </ButtonLink>
        }
      />

      {projects.error && !list ? (
        <Alert action={<Button size="sm" onClick={projects.reload}>Retry</Button>}>{projects.error.message}</Alert>
      ) : !list ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <ProjectCard key={p.id} project={p} latest={latest[p.id]} />
          ))}
        </div>
      )}
    </>
  );
}
