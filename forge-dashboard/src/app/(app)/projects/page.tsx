"use client";

import { ArrowUpRight, Boxes, GitBranch, Layers, Plus, Split } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Sparkline } from "@/components/charts/Sparkline";
import { PageHeader } from "@/components/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
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

function ProjectCard({ project, recent }: { project: Project; recent: Deployment[] | undefined }) {
  const latest = recent?.[0];
  const isLive = !!project.liveDeploymentId;
  const host = project.liveUrl.replace(/^https?:\/\//, "");
  const durations = (recent ?? []).map(deployDurationMs).reverse();
  const med = median(durations.filter((v): v is number => v !== null));
  const enoughData = durations.filter((v) => v !== null).length > 1;

  return (
    <li className="group relative flex flex-col rounded-lg border border-gray-alpha-400 bg-background-100 p-4 transition-[border-color,box-shadow] hover:border-gray-alpha-500 hover:shadow-menu">
      {/* Identity */}
      <div className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-gray-alpha-400 bg-background-200 text-label-13 font-semibold text-gray-1000">
          {project.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <Link
            href={`/projects/${project.id}`}
            className="block truncate text-heading-14 text-gray-1000 after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:shadow-[0_0_0_2px_var(--ds-background-100),0_0_0_4px_var(--ds-blue-700)]"
          >
            {project.name}
          </Link>
          {isLive ? (
            <a
              href={project.liveUrl}
              target="_blank"
              rel="noreferrer"
              className="relative z-10 inline-flex max-w-full items-center gap-1 rounded-sm text-label-13 text-gray-900 hover:text-gray-1000 hover:underline focus-ring"
            >
              <span className="truncate">{host}</span>
              <ArrowUpRight className="size-3 shrink-0" aria-hidden />
            </a>
          ) : (
            <p className="truncate text-label-13 text-gray-900">{host}</p>
          )}
        </div>
        <div className="shrink-0">
          {recent === undefined ? (
            <Skeleton className="h-5 w-16" />
          ) : latest ? (
            <StatusBadge status={latest.status} className="text-label-13" />
          ) : (
            <Badge size="sm">Not deployed</Badge>
          )}
        </div>
      </div>

      {/* Repo */}
      <p className="mt-4 inline-flex max-w-full items-center gap-1.5 self-start rounded-full bg-gray-100 px-2 py-0.5 text-label-12 font-medium text-gray-1000">
        <GithubIcon className="size-3.5 shrink-0" />
        <span className="truncate">
          {project.repoOwner}/{project.repoName}
        </span>
      </p>

      {/* Last deploy */}
      <div className="mt-3 min-h-10">
        {recent === undefined ? (
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ) : latest ? (
          <>
            <p className="truncate text-label-14 text-gray-1000">{deploymentTitle(latest)}</p>
            <p className="mt-1 flex min-w-0 items-center gap-1.5 text-label-13 text-gray-900">
              <span>{relativeTime(latest.createdAt)} on</span>
              <GitBranch className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate font-mono">{project.branch}</span>
              <span className="shrink-0 font-mono">{shortSha(latest.commitSha)}</span>
            </p>
          </>
        ) : (
          <p className="text-label-13 text-gray-900">No deployments yet.</p>
        )}
      </div>

      {/* Topology + build time */}
      <div className="mt-4 flex items-center gap-3 border-t border-gray-alpha-400 pt-3 text-label-12 text-gray-900">
        <span className="inline-flex items-center gap-1" title="Replicas">
          <Layers className="size-3.5" aria-hidden />
          <span className="tabular">{project.replicas ?? 1}×</span>
        </span>
        <span className="inline-flex items-center gap-1" title="Rollout mode">
          <Split className="size-3.5" aria-hidden />
          {project.rollout === "CANARY" ? "Canary" : "Blue-green"}
        </span>
        <span className="ml-auto flex items-center gap-2" title="Recent deploy durations">
          {enoughData ? (
            <>
              <Sparkline values={durations} className="h-4 w-14" tone="text-gray-900" fill={false} />
              <span className="tabular">p50 {med !== null ? formatDuration(med) : "—"}</span>
            </>
          ) : recent === undefined ? null : (
            <span>Not enough data</span>
          )}
        </span>
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
        description={list ? `${list.length} ${list.length === 1 ? "project" : "projects"}, ${list.filter((p) => p.liveDeploymentId).length} live` : "Loading…"}
        actions={
          <ButtonLink href="/projects/new" variant="primary" size="sm" icon={<Plus className="size-4" aria-hidden />}>
            New project
          </ButtonLink>
        }
      />

      {projects.error && !list ? (
        <Alert action={<Button size="sm" onClick={projects.reload}>Retry</Button>}>{projects.error.message}</Alert>
      ) : !list ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg border border-gray-alpha-400 bg-background-100 p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-44" />
                </div>
              </div>
              <Skeleton className="mt-4 h-5 w-36 rounded-full" />
              <Skeleton className="mt-3 h-3.5 w-3/4" />
              <Skeleton className="mt-2 h-3 w-1/2" />
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
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <ProjectCard key={p.id} project={p} recent={recent[p.id]} />
          ))}
        </ul>
      )}
    </>
  );
}
