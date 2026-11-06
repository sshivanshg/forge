"use client";

import { AlertOctagon, ArrowRight, Bot, CheckCircle2, Plus, Rocket } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ActivityRow, ActivitySkeleton } from "@/components/ActivityFeed";
import { DeploysChart } from "@/components/charts/DeploysChart";
import { Sparkline } from "@/components/charts/Sparkline";
import { Kpi, KpiGrid } from "@/components/Kpi";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/components/AuthProvider";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { formatDuration, relativeTime, shortSha } from "@/lib/format";
import { useQuery, useTick } from "@/lib/hooks";
import { fetchActivity, fetchOverview } from "@/lib/insights";
import { FAILURE_LABEL, isInProgress } from "@/lib/status";
import type { ActivityItem, Insight } from "@/lib/types";

function pct(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return "—";
  const v = rate <= 1 ? rate * 100 : rate;
  return `${v >= 99.95 || v === 0 ? v.toFixed(0) : v.toFixed(1)}%`;
}

function Panel({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`overflow-hidden rounded-lg border border-white/[0.07] bg-ink-900 ${className ?? ""}`}>
      <header className="flex h-11 items-center justify-between border-b border-white/[0.06] px-4">
        <h2 className="text-[13px] font-semibold text-zinc-200">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

/** The newest failed deployment of each project whose latest deploy failed. */
function needsAttention(items: ActivityItem[]): ActivityItem[] {
  const seen = new Set<string>();
  const out: ActivityItem[] = [];
  for (const d of items) {
    if (seen.has(d.projectId)) continue;
    seen.add(d.projectId);
    if (d.status === "FAILED") out.push(d);
  }
  return out.slice(0, 4);
}

function AttentionItem({ d }: { d: ActivityItem }) {
  const [insight, setInsight] = useState<Insight | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    api.deployments.insight(d.id).then(
      (i) => alive && setInsight(i),
      () => alive && setInsight(null),
    );
    return () => {
      alive = false;
    };
  }, [d.id]);

  return (
    <li className="group relative px-4 py-3 transition-colors hover:bg-white/[0.025]">
      <div className="flex items-center gap-2 text-[13px]">
        <AlertOctagon className="size-3.5 shrink-0 text-red-400" aria-hidden />
        <Link href={`/deployments/${d.id}`} className="truncate font-medium text-zinc-100 after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-brand-500/70 focus-visible:after:ring-inset">
          {d.projectName}
        </Link>
        <span className="ml-auto shrink-0 font-mono text-[11px] text-zinc-500">
          {shortSha(d.commitSha)} · {relativeTime(d.createdAt)}
        </span>
      </div>
      <p className="mt-0.5 pl-5.5 text-xs text-red-300/80">{d.failureReason ? FAILURE_LABEL[d.failureReason] : "Failed"}</p>
      <div className="mt-2 ml-5.5 flex gap-2 rounded-md border border-brand-500/15 bg-brand-500/[0.05] px-2.5 py-2 text-xs leading-relaxed">
        <Bot className="mt-0.5 size-3.5 shrink-0 text-brand-400" aria-hidden />
        {insight === undefined ? (
          <Skeleton className="my-0.5 h-3 w-4/5 bg-brand-400/10" />
        ) : insight ? (
          <span className="line-clamp-2 text-zinc-300">{insight.summary}</span>
        ) : (
          <span className="text-zinc-500">No agent diagnosis recorded.</span>
        )}
      </div>
    </li>
  );
}

export default function OverviewPage() {
  const { user } = useAuth();
  const overview = useQuery("overview", fetchOverview);
  const activity = useQuery("activity:10", () => fetchActivity(12));
  const anyRunning = !!activity.data?.some((d) => isInProgress(d.status));
  useTick(anyRunning ? 1000 : 30_000);

  const reloadA = activity.reload;
  const reloadO = overview.reload;
  useEffect(() => {
    const t = window.setInterval(() => {
      reloadA();
      reloadO();
    }, anyRunning ? 4000 : 20_000);
    return () => window.clearInterval(t);
  }, [anyRunning, reloadA, reloadO]);

  const o = overview.data;
  const items = activity.data;
  const attention = items ? needsAttention(items) : undefined;
  const loading = !o;
  const daily = o?.deploysByDay ?? [];

  if (o && o.projects === 0) {
    return (
      <>
        <PageHeader title={`Welcome${user ? `, ${user.displayName.split(" ")[0]}` : ""}`} description="Your workspace is empty. Connect a repository to ship your first deploy." />
        <EmptyState
          icon={<Rocket className="size-5" aria-hidden />}
          title="Deploy your first project"
          description="Point Forge at a GitHub repository. It detects how to build it, ships it to a live URL and explains any failure."
          action={
            <ButtonLink href="/projects/new" variant="primary" icon={<Plus className="size-4" aria-hidden />}>
              New project
            </ButtonLink>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Overview"
        description="Health of every project in this workspace, last 7 days."
        actions={
          <ButtonLink href="/projects/new" variant="primary" size="sm" icon={<Plus className="size-4" aria-hidden />}>
            New project
          </ButtonLink>
        }
      />

      {overview.error && !o && (
        <Alert className="mb-6" action={<Button size="sm" onClick={overview.reload}>Retry</Button>}>
          {overview.error.message}
        </Alert>
      )}

      <KpiGrid>
        <Kpi label="Projects" loading={loading} value={o?.projects ?? 0} sub="in this workspace" />
        <Kpi
          label="Live"
          loading={loading}
          value={
            <span>
              {o?.liveProjects ?? 0}
              <span className="text-base text-zinc-600">/{o?.projects ?? 0}</span>
            </span>
          }
          sub={o && o.liveProjects === o.projects ? "all serving traffic" : "serving traffic"}
        />
        <Kpi
          label="Deploys · 7d"
          loading={loading}
          value={o?.deploys7d ?? 0}
          sub={o?.failed7d ? <span className="text-red-400/90">{o.failed7d} failed</span> : "no failures"}
          chart={<Sparkline values={daily.slice(-7).map((d) => d.succeeded + d.failed)} className="h-full w-full" tone="text-zinc-400" />}
        />
        <Kpi label="Success rate" loading={loading} value={pct(o?.successRate7d)} sub="finished deploys" />
        <Kpi
          label="Median deploy"
          loading={loading}
          value={<span className="font-mono text-[24px]">{o?.medianDeployMs7d != null ? formatDuration(o.medianDeployMs7d) : "—"}</span>}
          sub="push to live"
        />
      </KpiGrid>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel title="Deployments · 14 days">
          <div className="px-4 pt-3 pb-4">{o ? <DeploysChart days={daily} /> : <Skeleton className="h-[180px]" />}</div>
        </Panel>

        <Panel
          title="Needs attention"
          action={attention && attention.length > 0 ? <span className="rounded-full bg-red-500/15 px-1.5 font-mono text-[11px] text-red-300">{attention.length}</span> : undefined}
        >
          {!attention ? (
            <ActivitySkeleton rows={2} />
          ) : attention.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <CheckCircle2 className="size-5 text-emerald-400" aria-hidden />
              <p className="mt-2 text-[13px] font-medium text-zinc-200">All clear</p>
              <p className="mt-0.5 text-xs text-zinc-500">No project&apos;s latest deploy has failed.</p>
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {attention.map((d) => (
                <AttentionItem key={d.id} d={d} />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        className="mt-6"
        title="Recent activity"
        action={
          <Link href="/activity" className="inline-flex items-center gap-1 rounded text-xs text-zinc-500 hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-brand-500/70 focus-visible:outline-none">
            View all <ArrowRight className="size-3" aria-hidden />
          </Link>
        }
      >
        {activity.error && !items ? (
          <div className="p-4">
            <Alert action={<Button size="sm" onClick={activity.reload}>Retry</Button>}>{activity.error.message}</Alert>
          </div>
        ) : !items ? (
          <ActivitySkeleton />
        ) : items.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-zinc-500">No deployments yet. Open a project and press Deploy.</p>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {items.slice(0, 8).map((d) => (
              <ActivityRow key={d.id} d={d} />
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
