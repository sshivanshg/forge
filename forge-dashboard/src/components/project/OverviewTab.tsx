"use client";

import { ArrowUpRight, Copy, GitBranch, GitCommitHorizontal } from "lucide-react";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { Sparkline } from "@/components/charts/Sparkline";
import { TriggerLabel } from "@/components/deployment/TriggerLabel";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { cx } from "@/components/ui/cx";
import { api, ApiError } from "@/lib/api";
import { absoluteTime, durationBetween, relativeTime, shortSha } from "@/lib/format";
import { useQuery, useTick } from "@/lib/hooks";
import { deploymentTitle, TONE_CLASSES } from "@/lib/status";
import type { Deployment, Project, RuntimeInstance } from "@/lib/types";
import { useTraffic } from "@/lib/useTraffic";

function Muted({ children }: { children: ReactNode }) {
  return <p className="px-6 py-10 text-center text-copy-14 text-gray-900">{children}</p>;
}

const HEALTHY = new Set(["RUNNING", "HEALTHY", "LIVE", "READY", "UP"]);
const STARTING = new Set(["STARTING", "PENDING", "CREATED", "DEPLOYING", "HEALTH_CHECKING"]);

function stateTone(state: string) {
  const s = state.toUpperCase();
  if (HEALTHY.has(s)) return { ...TONE_CLASSES.green, pulse: false };
  if (STARTING.has(s)) return { ...TONE_CLASSES.amber, pulse: true };
  return { ...TONE_CLASSES.red, pulse: false };
}

function weightPct(w: number | null, all: RuntimeInstance[]): number {
  if (w === null) return all.length ? 100 / all.length : 0;
  const total = all.reduce((a, i) => a + (i.trafficWeight ?? 0), 0);
  if (total > 0 && total <= 1.0001) return w * 100;
  if (total > 0 && Math.abs(total - 100) > 1) return (w / total) * 100;
  return w;
}

function ProductionDeployment({ project, rows }: { project: Project; rows: Deployment[] | undefined }) {
  const toast = useToast();
  const isLive = !!project.liveDeploymentId;
  const host = project.liveUrl.replace(/^https?:\/\//, "");
  const live = rows?.find((d) => d.id === project.liveDeploymentId);
  const commitUrl = live?.commitSha ? `${project.repoUrl}/commit/${live.commitSha}` : null;

  return (
    <Card>
      <CardHeader
        title="Production Deployment"
        description="The deployment that is available to your visitors."
        actions={
          project.liveDeploymentId && (
            <ButtonLink href={`/deployments/${project.liveDeploymentId}`} size="sm" variant="secondary">
              Inspect deployment
            </ButtonLink>
          )
        }
      />
      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex aspect-[16/10] flex-col items-center justify-center gap-1 rounded-md border border-gray-alpha-400 bg-background-200 px-4 text-center">
          {isLive ? (
            <p className="max-w-full truncate font-mono text-label-14 text-gray-1000">{host}</p>
          ) : (
            <>
              <p className="text-label-14 font-medium text-gray-1000">Not live</p>
              <p className="text-copy-13 text-gray-900">Deploy to get a production URL.</p>
            </>
          )}
        </div>

        <dl className="grid content-start gap-x-6 gap-y-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-label-13 text-gray-900">Deployment URL</dt>
            <dd className="mt-1.5 flex min-w-0 items-center gap-1 text-label-14">
              {isLive ? (
                <>
                  <a
                    href={project.liveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-w-0 items-center gap-1 rounded-sm font-mono text-gray-1000 hover:underline focus-ring"
                  >
                    <span className="truncate">{host}</span>
                    <ArrowUpRight className="size-4 shrink-0 text-gray-900" aria-hidden />
                  </a>
                  <button
                    type="button"
                    aria-label="Copy live URL"
                    onClick={() => navigator.clipboard?.writeText(project.liveUrl).then(() => toast.success("Copied live URL"))}
                    className="rounded-md p-1 text-gray-900 transition-colors hover:bg-gray-alpha-200 hover:text-gray-1000 focus-ring"
                  >
                    <Copy className="size-4" />
                  </button>
                </>
              ) : (
                <span className="truncate font-mono text-gray-900">{host}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-label-13 text-gray-900">Status</dt>
            <dd className="mt-1.5">
              {live ? (
                <StatusBadge status={live.status} />
              ) : (
                <span className="text-label-14 text-gray-1000">{isLive ? "Live" : "Not deployed"}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-label-13 text-gray-900">Created</dt>
            <dd className="mt-1.5 flex flex-wrap items-center gap-x-2 text-label-14 text-gray-1000">
              {live ? (
                <>
                  <span title={absoluteTime(live.createdAt)}>{relativeTime(live.createdAt)}</span>
                  <span className="text-gray-900">
                    <TriggerLabel trigger={live.trigger} />
                  </span>
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-label-13 text-gray-900">Rollout</dt>
            <dd className="mt-1.5 text-label-14 text-gray-1000">{project.rollout === "CANARY" ? "Canary" : "Blue-green"}</dd>
          </div>
          <div>
            <dt className="text-label-13 text-gray-900">Replicas</dt>
            <dd className="mt-1.5 text-label-14 text-gray-1000 tabular">{project.replicas}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-label-13 text-gray-900">Source</dt>
            <dd className="mt-1.5 space-y-1 text-label-14 text-gray-1000">
              <p className="flex items-center gap-1.5">
                <GitBranch className="size-4 shrink-0 text-gray-900" aria-hidden />
                <span className="truncate font-mono">{project.branch}</span>
              </p>
              {live && (
                <p className="flex min-w-0 items-center gap-1.5">
                  <GitCommitHorizontal className="size-4 shrink-0 text-gray-900" aria-hidden />
                  {commitUrl ? (
                    <a href={commitUrl} target="_blank" rel="noreferrer" className="shrink-0 rounded-sm font-mono hover:underline focus-ring">
                      {shortSha(live.commitSha)}
                    </a>
                  ) : (
                    <span className="shrink-0 font-mono">{shortSha(live.commitSha)}</span>
                  )}
                  <span className="truncate text-gray-900">{deploymentTitle(live)}</span>
                </p>
              )}
            </dd>
          </div>
        </dl>
      </div>
    </Card>
  );
}

function InstancesPanel({ project }: { project: Project }) {
  const q = useQuery(`instances:${project.id}`, () => api.projects.instances(project.id));
  useTick(15_000);
  const reload = q.reload;
  useEffect(() => {
    const t = window.setInterval(reload, 5000);
    return () => window.clearInterval(t);
  }, [reload]);

  const unavailable = q.error instanceof ApiError && q.error.status === 404 && !q.data;
  const list = q.data ? [...q.data].sort((a, b) => a.replicaIndex - b.replicaIndex) : undefined;

  return (
    <Card>
      <CardHeader
        title="Instances"
        actions={
          <span className="text-label-13 text-gray-900 tabular">
            {list ? `${list.length} / ${project.replicas} desired` : `${project.replicas} desired`}
          </span>
        }
      />
      {unavailable ? (
        <Muted>Instance telemetry isn&apos;t available on this server yet.</Muted>
      ) : q.error && !list ? (
        <p className="px-6 py-10 text-center text-copy-14 text-red-900">{q.error.message}</p>
      ) : !list ? (
        <div className="space-y-2 p-6">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : list.length === 0 ? (
        <Muted>No instances running. Deploy to start {project.replicas === 1 ? "one" : project.replicas}.</Muted>
      ) : (
        <ul className="divide-y divide-gray-alpha-400">
          {list.map((i) => {
            const t = stateTone(i.state);
            const w = weightPct(i.trafficWeight, list);
            const canary = project.liveDeploymentId && i.deploymentId !== project.liveDeploymentId;
            return (
              <li key={i.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-6 py-3 sm:grid-cols-[auto_minmax(0,1fr)_9rem_auto]">
                <span className="relative inline-flex size-2.5">
                  {t.pulse && <span className={cx("absolute inset-0 animate-ping rounded-full opacity-50", t.dot)} />}
                  <span className={cx("relative size-2.5 rounded-full", t.dot)} />
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-label-14 text-gray-1000">
                    <span className="font-mono">replica-{i.replicaIndex}</span>
                    {canary && (
                      <Badge tone="purple" size="sm">
                        Canary
                      </Badge>
                    )}
                  </p>
                  <p className="truncate font-mono text-label-12 text-gray-900">
                    {i.address ?? "—"} ·{" "}
                    <Link href={`/deployments/${i.deploymentId}`} className="rounded-sm hover:text-gray-1000 hover:underline focus-ring">
                      {i.deploymentId.slice(0, 8)}
                    </Link>
                  </p>
                </div>
                <div className="col-span-3 flex items-center gap-2 sm:col-span-1" title="Traffic weight">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className={cx("h-full rounded-full transition-[width] duration-700", canary ? "bg-blue-700" : "bg-gray-1000")}
                      style={{ width: `${Math.min(100, w)}%` }}
                    />
                  </div>
                  <span className="w-9 text-right text-label-12 text-gray-900 tabular">{Math.round(w)}%</span>
                </div>
                <div className="row-start-1 text-right sm:row-auto">
                  <p className={cx("text-label-13 font-medium", t.text)}>{i.state.charAt(0) + i.state.slice(1).toLowerCase()}</p>
                  <p className="text-label-12 text-gray-900 tabular">{i.startedAt ? `up ${durationBetween(i.startedAt, null)}` : ""}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function Metric({ label, value, unit, values, tone, max }: { label: string; value: string; unit?: string; values: (number | null)[]; tone: string; max?: number }) {
  return (
    <div className="bg-background-100 px-6 py-4">
      <p className="text-label-14 text-gray-900">{label}</p>
      <p className="mt-1 text-heading-24 text-gray-1000 tabular">
        {value}
        {unit && <span className="ml-1 text-label-14 font-normal text-gray-900">{unit}</span>}
      </p>
      <Sparkline values={values.length > 1 ? values : [0, 0]} className="mt-3 h-10 w-full" tone={tone} max={max} />
    </div>
  );
}

function TrafficPanel({ project }: { project: Project }) {
  const t = useTraffic(project.liveDeploymentId);
  const pts = t.points;
  const fmt = (v: number | null | undefined, digits = 1) => (v === null || v === undefined ? "—" : v.toFixed(digits));

  return (
    <Card>
      <CardHeader
        title="Live traffic"
        actions={
          <span className="inline-flex items-center gap-1.5 text-label-13 text-gray-900">
            {t.phase === "ok" && <span className="size-2 animate-pulse rounded-full bg-green-700" aria-hidden />}
            {!project.liveDeploymentId ? "" : t.phase === "ok" ? "2s · last 2 min" : t.phase === "loading" ? "Connecting" : ""}
          </span>
        }
      />
      {!project.liveDeploymentId ? (
        <Muted>Traffic appears once a deployment is live.</Muted>
      ) : t.phase === "unavailable" ? (
        <Muted>Traffic metrics aren&apos;t available on this server yet.</Muted>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-px bg-gray-alpha-400 sm:grid-cols-3">
            <Metric label="Requests / s" value={fmt(t.latest?.rps)} values={pts.map((p) => p.rps)} tone="text-gray-1000" />
            <Metric
              label="Error rate"
              value={t.latest?.errorRate != null ? (t.latest.errorRate * 100).toFixed(2) : "—"}
              unit="%"
              values={pts.map((p) => (p.errorRate === null ? null : p.errorRate * 100))}
              tone={t.latest?.errorRate ? "text-red-700" : "text-gray-700"}
              max={Math.max(1, ...pts.map((p) => (p.errorRate ?? 0) * 100))}
            />
            <Metric label="Mean latency" value={fmt(t.latest?.latencyMs, 0)} unit="ms" values={pts.map((p) => p.latencyMs)} tone="text-blue-700" />
          </div>
          {t.totals && (
            <p className="rounded-b-lg border-t border-gray-alpha-400 bg-background-200 px-6 py-3 text-label-13 text-gray-900 tabular">
              {t.totals.requests.toLocaleString()} requests · {t.totals.serverErrors.toLocaleString()} 5xx since deploy
            </p>
          )}
        </>
      )}
    </Card>
  );
}

function LatestDeploys({ rows }: { rows: Deployment[] | undefined }) {
  return (
    <Card>
      <CardHeader title="Recent deployments" />
      {!rows ? (
        <div className="space-y-2 p-6">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      ) : rows.length === 0 ? (
        <Muted>No deployments yet.</Muted>
      ) : (
        <ul className="divide-y divide-gray-alpha-400">
          {rows.map((d) => (
            <li key={d.id} className="relative flex items-center gap-3 px-6 py-3 transition-colors hover:bg-gray-alpha-100">
              <span className="w-28 shrink-0">
                <StatusBadge status={d.status} />
              </span>
              <Link
                href={`/deployments/${d.id}`}
                className="min-w-0 flex-1 truncate text-label-14 text-gray-1000 after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:shadow-[inset_0_0_0_2px_var(--ds-blue-700)]"
              >
                {deploymentTitle(d)}
              </Link>
              <span className="hidden font-mono text-label-13 text-gray-900 sm:inline">{shortSha(d.commitSha)}</span>
              <span className="shrink-0 text-label-13 text-gray-900">{relativeTime(d.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function OverviewTab({ project }: { project: Project }) {
  const q = useQuery(`deployments:${project.id}:overview`, () => api.deployments.list(project.id, 0, 5));
  const rows = q.data?.content;
  return (
    <div className="space-y-6">
      <ProductionDeployment project={project} rows={rows} />
      <TrafficPanel project={project} />
      <div className="grid gap-6 lg:grid-cols-2">
        <InstancesPanel project={project} />
        <LatestDeploys rows={rows} />
      </div>
    </div>
  );
}
