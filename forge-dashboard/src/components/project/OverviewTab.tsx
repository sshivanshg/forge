"use client";

import { Activity, Boxes, Server } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Sparkline } from "@/components/charts/Sparkline";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { cx } from "@/components/ui/cx";
import { api, ApiError } from "@/lib/api";
import { durationBetween, relativeTime, shortSha } from "@/lib/format";
import { useQuery, useTick } from "@/lib/hooks";
import { deploymentTitle } from "@/lib/status";
import type { Project, RuntimeInstance } from "@/lib/types";
import { useTraffic } from "@/lib/useTraffic";

function Panel({ title, icon, aside, children }: { title: string; icon: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-white/[0.07] bg-ink-900">
      <header className="flex h-11 items-center gap-2 border-b border-white/[0.06] px-4">
        <span className="text-zinc-500">{icon}</span>
        <h2 className="text-[13px] font-semibold text-zinc-200">{title}</h2>
        <div className="ml-auto">{aside}</div>
      </header>
      {children}
    </section>
  );
}

const HEALTHY = new Set(["RUNNING", "HEALTHY", "LIVE", "READY", "UP"]);
const STARTING = new Set(["STARTING", "PENDING", "CREATED", "DEPLOYING", "HEALTH_CHECKING"]);

function stateTone(state: string) {
  const s = state.toUpperCase();
  if (HEALTHY.has(s)) return { dot: "bg-emerald-400", text: "text-emerald-300", pulse: false };
  if (STARTING.has(s)) return { dot: "bg-amber-400", text: "text-amber-300", pulse: true };
  return { dot: "bg-red-400", text: "text-red-300", pulse: false };
}

function weightPct(w: number | null, all: RuntimeInstance[]): number {
  if (w === null) return all.length ? 100 / all.length : 0;
  const total = all.reduce((a, i) => a + (i.trafficWeight ?? 0), 0);
  if (total > 0 && total <= 1.0001) return w * 100;
  if (total > 0 && Math.abs(total - 100) > 1) return (w / total) * 100;
  return w;
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
    <Panel
      title="Instances"
      icon={<Server className="size-4" aria-hidden />}
      aside={<span className="font-mono text-[11px] text-zinc-500 tabular">{list ? `${list.length} / ${project.replicas} desired` : `${project.replicas} desired`}</span>}
    >
      {unavailable ? (
        <p className="px-4 py-8 text-center text-[13px] text-zinc-500">Instance telemetry isn&apos;t available on this server yet.</p>
      ) : q.error && !list ? (
        <p className="px-4 py-8 text-center text-[13px] text-red-300/80">{q.error.message}</p>
      ) : !list ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : list.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13px] text-zinc-500">No instances running. Deploy to start {project.replicas === 1 ? "one" : project.replicas}.</p>
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {list.map((i) => {
            const t = stateTone(i.state);
            const w = weightPct(i.trafficWeight, list);
            const canary = project.liveDeploymentId && i.deploymentId !== project.liveDeploymentId;
            return (
              <li key={i.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_9rem_auto]">
                <span className="relative inline-flex size-2">
                  {t.pulse && <span className={cx("absolute inset-0 animate-ping rounded-full opacity-60", t.dot)} />}
                  <span className={cx("relative size-2 rounded-full", t.dot)} />
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[13px] text-zinc-200">
                    <span className="font-mono">replica-{i.replicaIndex}</span>
                    {canary && <span className="rounded bg-cyan-500/10 px-1 text-[10px] font-medium text-cyan-300 uppercase">canary</span>}
                  </p>
                  <p className="truncate font-mono text-[11px] text-zinc-500">
                    {i.address ?? "—"} · <Link href={`/deployments/${i.deploymentId}`} className="hover:text-zinc-300">{i.deploymentId.slice(0, 8)}</Link>
                  </p>
                </div>
                <div className="col-span-3 flex items-center gap-2 sm:col-span-1" title="Traffic weight">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className={cx("h-full rounded-full transition-[width] duration-700", canary ? "bg-cyan-400" : "bg-emerald-400/80")} style={{ width: `${Math.min(100, w)}%` }} />
                  </div>
                  <span className="w-9 text-right font-mono text-[11px] text-zinc-400 tabular">{Math.round(w)}%</span>
                </div>
                <div className="row-start-1 text-right sm:row-auto">
                  <p className={cx("text-xs font-medium", t.text)}>{i.state.charAt(0) + i.state.slice(1).toLowerCase()}</p>
                  <p className="font-mono text-[10px] text-zinc-600 tabular">{i.startedAt ? `up ${durationBetween(i.startedAt, null)}` : ""}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function Metric({ label, value, unit, values, tone, max }: { label: string; value: string; unit?: string; values: (number | null)[]; tone: string; max?: number }) {
  return (
    <div className="bg-ink-900 px-4 py-3">
      <p className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">{label}</p>
      <p className="mt-1.5 font-mono text-xl text-zinc-50 tabular">
        {value}
        {unit && <span className="ml-1 text-xs text-zinc-500">{unit}</span>}
      </p>
      <Sparkline values={values.length > 1 ? values : [0, 0]} className="mt-2 h-10 w-full" tone={tone} max={max} />
    </div>
  );
}

function TrafficPanel({ project }: { project: Project }) {
  const t = useTraffic(project.liveDeploymentId);
  const pts = t.points;
  const fmt = (v: number | null | undefined, digits = 1) => (v === null || v === undefined ? "—" : v.toFixed(digits));

  return (
    <Panel
      title="Live traffic"
      icon={<Activity className="size-4" aria-hidden />}
      aside={
        <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
          {t.phase === "ok" && <span className="size-1.5 animate-pulse rounded-full bg-cyan-400" aria-hidden />}
          {t.phase === "ok" ? "2s · last 2 min" : t.phase === "loading" ? "connecting" : ""}
        </span>
      }
    >
      {!project.liveDeploymentId ? (
        <p className="px-4 py-10 text-center text-[13px] text-zinc-500">Traffic appears once a deployment is live.</p>
      ) : t.phase === "unavailable" ? (
        <p className="px-4 py-10 text-center text-[13px] text-zinc-500">Traffic metrics aren&apos;t available on this server yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-px bg-white/[0.06] sm:grid-cols-3">
            <Metric label="Requests / s" value={fmt(t.latest?.rps)} values={pts.map((p) => p.rps)} tone="text-cyan-400" />
            <Metric
              label="Error rate"
              value={t.latest?.errorRate != null ? (t.latest.errorRate * 100).toFixed(2) : "—"}
              unit="%"
              values={pts.map((p) => (p.errorRate === null ? null : p.errorRate * 100))}
              tone={t.latest?.errorRate ? "text-red-400" : "text-zinc-500"}
              max={Math.max(1, ...pts.map((p) => (p.errorRate ?? 0) * 100))}
            />
            <Metric label="Mean latency" value={fmt(t.latest?.latencyMs, 0)} unit="ms" values={pts.map((p) => p.latencyMs)} tone="text-brand-400" />
          </div>
          {t.totals && (
            <p className="border-t border-white/[0.06] px-4 py-2 font-mono text-[11px] text-zinc-500 tabular">
              {t.totals.requests.toLocaleString()} requests · {t.totals.serverErrors.toLocaleString()} 5xx since deploy
            </p>
          )}
        </>
      )}
    </Panel>
  );
}

function LatestDeploys({ project }: { project: Project }) {
  const q = useQuery(`deployments:${project.id}:overview`, () => api.deployments.list(project.id, 0, 5));
  const rows = q.data?.content;
  return (
    <Panel title="Recent deployments" icon={<Boxes className="size-4" aria-hidden />}>
      {!rows ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13px] text-zinc-500">No deployments yet.</p>
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {rows.map((d) => (
            <li key={d.id} className="relative flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02]">
              <StatusBadge status={d.status} />
              <Link href={`/deployments/${d.id}`} className="min-w-0 flex-1 truncate text-[13px] text-zinc-200 after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-brand-500/70">
                {deploymentTitle(d)}
              </Link>
              <span className="hidden font-mono text-[11px] text-zinc-500 sm:inline">{shortSha(d.commitSha)}</span>
              <span className="shrink-0 text-[11px] text-zinc-500">{relativeTime(d.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function OverviewTab({ project }: { project: Project }) {
  return (
    <div className="space-y-6">
      <TrafficPanel project={project} />
      <div className="grid gap-6 lg:grid-cols-2">
        <InstancesPanel project={project} />
        <LatestDeploys project={project} />
      </div>
    </div>
  );
}
