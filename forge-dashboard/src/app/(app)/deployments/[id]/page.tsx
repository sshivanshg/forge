"use client";

import { ArrowUpRight, CircleStop, GitBranch, GitCommitHorizontal, Undo2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentInsightCard } from "@/components/deployment/AgentInsightCard";
import { PipelineStepper } from "@/components/deployment/PipelineStepper";
import { RollbackDialog } from "@/components/deployment/RollbackDialog";
import { TrafficSplit } from "@/components/deployment/TrafficSplit";
import { TriggerLabel } from "@/components/deployment/TriggerLabel";
import { useBreadcrumbs } from "@/components/shell/Breadcrumbs";
import { LogTerminal, StreamIndicator, type TerminalLine } from "@/components/LogTerminal";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
import { absoluteTime, durationBetween, relativeTime, shortSha } from "@/lib/format";
import { useQuery, useTick } from "@/lib/hooks";
import {
  canCancel,
  canRollback,
  deploymentTitle,
  FAILURE_LABEL,
  isInProgress,
  isPipelineStep,
  stepForFailure,
  usedCanary,
} from "@/lib/status";
import { ALL_PIPELINE_STEPS, PIPELINE_STEPS } from "@/lib/types";
import type { Deployment, DeploymentStatus, FailureReason, LogLine, PipelineStep } from "@/lib/types";
import { useEventStream } from "@/lib/useEventStream";

interface LiveStatus {
  status: DeploymentStatus;
  failureReason: FailureReason | null;
}

/** Collects streamed log lines, de-duplicated by seq and flushed once per animation frame. */
function useLogBuffer() {
  const [lines, setLines] = useState<LogLine[]>([]);
  const seen = useRef(new Set<number>());
  const pending = useRef<LogLine[]>([]);
  const frame = useRef<number | null>(null);

  const flush = useCallback(() => {
    frame.current = null;
    const batch = pending.current;
    pending.current = [];
    if (batch.length === 0) return;
    setLines((prev) => {
      const merged = prev.concat(batch);
      // The replay is ordered; only sort if a late line arrived out of order.
      for (let i = prev.length; i < merged.length; i++) {
        if (i > 0 && merged[i].seq < merged[i - 1].seq) return merged.sort((a, b) => a.seq - b.seq);
      }
      return merged;
    });
  }, []);

  const add = useCallback(
    (incoming: LogLine[]) => {
      for (const l of incoming) {
        if (typeof l?.seq !== "number" || seen.current.has(l.seq)) continue;
        seen.current.add(l.seq);
        pending.current.push(l);
      }
      if (pending.current.length && frame.current === null) frame.current = window.requestAnimationFrame(flush);
    },
    [flush],
  );

  useEffect(() => () => {
    if (frame.current !== null) window.cancelAnimationFrame(frame.current);
  }, []);

  return { lines, add };
}

function stoppedStep(d: Deployment, status: DeploymentStatus, lastStep: PipelineStep | null): PipelineStep | null {
  if (status !== "FAILED" && status !== "CANCELLED") return null;
  const entry = [...(d.timeline ?? [])].reverse().find((t) => t.to === status);
  if (entry && isPipelineStep(entry.from)) return entry.from;
  if (lastStep) return lastStep;
  if (status === "FAILED") return stepForFailure(d.failureReason);
  return d.startedAt ? "BUILDING" : "QUEUED";
}

export default function DeploymentPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const deployment = useQuery(`deployment:${id}`, () => api.deployments.get(id));
  const d = deployment.data;
  const project = useQuery(d ? `project:${d.projectId}` : null, () => api.projects.get(d!.projectId));

  const [live, setLive] = useState<LiveStatus | null>(null);
  const [lastStep, setLastStep] = useState<PipelineStep | null>(null);
  const [seenAt, setSeenAt] = useState<Partial<Record<DeploymentStatus, string>>>({});
  const { lines, add } = useLogBuffer();
  const reload = deployment.reload;

  const stream = useEventStream(api.deployments.logStreamPath(id), {
    log: (data) => add([data as LogLine]),
    status: (data) => {
      const s = data as LiveStatus;
      setLive(s);
      if (isPipelineStep(s.status)) setLastStep(s.status);
      setSeenAt((m) => (m[s.status] ? m : { ...m, [s.status]: new Date().toISOString() }));
      reload();
    },
    done: (_data, ctx) => {
      ctx.close();
      reload();
    },
  });

  // If the live stream can't be opened at all, fall back to the stored log.
  useEffect(() => {
    if (stream.state !== "error") return;
    api.deployments.logs(id, 0, 5000).then(add, () => undefined);
  }, [stream.state, id, add]);

  const status: DeploymentStatus | undefined = live?.status ?? d?.status;
  const running = !!status && isInProgress(status);
  useTick(1000, running);

  // The traffic share changes within CANARY (no status event), so poll while it lasts.
  useEffect(() => {
    if (status !== "CANARY") return;
    const timer = window.setInterval(reload, 3000);
    return () => window.clearInterval(timer);
  }, [status, reload]);

  const enteredAt = useMemo(() => {
    const m: Partial<Record<DeploymentStatus, string>> = { ...seenAt };
    if (d) m.QUEUED = d.createdAt;
    for (const t of d?.timeline ?? []) m[t.to] = t.at; // server timestamps win
    return m;
  }, [d, seenAt]);

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<Deployment | null>(null);

  async function cancel() {
    setCancelling(true);
    try {
      const updated = await api.deployments.cancel(id);
      deployment.setData(updated);
      setLive({ status: updated.status, failureReason: updated.failureReason });
      toast.info("Deployment cancelled");
    } catch (err) {
      toast.error("Couldn't cancel", errorMessage(err));
    } finally {
      setCancelling(false);
      setConfirmCancel(false);
    }
  }

  const projectName = project.data?.name;
  useBreadcrumbs(
    [
      { label: "Projects", href: "/projects" },
      { label: projectName ?? "…", href: d ? `/projects/${d.projectId}` : undefined },
      { label: id.slice(0, 8), mono: true },
    ],
    `dep:${id}:${projectName}`,
  );

  const terminalLines: TerminalLine[] = useMemo(
    () => lines.map((l) => ({ key: l.seq, line: l.line, source: l.source, ts: l.ts })),
    [lines],
  );

  if (deployment.error && !d) {
    return (
      <Alert action={<Button size="sm" onClick={deployment.reload}>Retry</Button>}>
        {deployment.error.status === 404 ? "This deployment doesn't exist or isn't yours." : deployment.error.message}
      </Alert>
    );
  }

  if (!d || !status) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-96 max-w-full" />
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-[420px] rounded-lg" />
      </div>
    );
  }

  const p = project.data;
  const failureReason = live?.failureReason ?? d.failureReason;
  const isLiveNow = status === "LIVE"; // only one deployment per project can be LIVE
  const commitUrl = p && d.commitSha ? `${p.repoUrl}/commit/${d.commitSha}` : null;
  const willCanary =
    running &&
    p?.rollout === "CANARY" &&
    !!p.liveDeploymentId &&
    p.liveDeploymentId !== d.id &&
    d.trigger !== "ROLLBACK" &&
    d.trigger !== "RECOVERY";
  const steps = usedCanary({ status, failureReason, timeline: d.timeline }) || willCanary ? ALL_PIPELINE_STEPS : PIPELINE_STEPS;

  const host = p?.liveUrl.replace(/^https?:\/\//, "");
  const duration = d.startedAt ? durationBetween(d.startedAt, running ? null : d.finishedAt) : "—";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="min-w-0 text-heading-32 break-words text-gray-1000">{deploymentTitle(d)}</h1>
        <div className="flex flex-wrap gap-2">
          {canCancel(status) && (
            <Button variant="secondary" onClick={() => setConfirmCancel(true)} icon={<CircleStop className="size-4" aria-hidden />}>
              Cancel
            </Button>
          )}
          {canRollback({ imageRef: d.imageRef, status }) && !isLiveNow && (
            <Button variant="secondary" onClick={() => setRollbackTarget(d)} icon={<Undo2 className="size-4" aria-hidden />}>
              Roll back to this
            </Button>
          )}
          {status === "LIVE" && p && (
            <a href={p.liveUrl} target="_blank" rel="noreferrer" className={buttonClass("primary", "md")}>
              Visit <ArrowUpRight className="size-4" aria-hidden />
            </a>
          )}
        </div>
      </div>

      {/* Summary */}
      <Card>
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="flex aspect-[16/10] flex-col items-center justify-center gap-2 rounded-md border border-gray-alpha-400 bg-background-200 px-4 text-center">
            {isLiveNow && host ? (
              <p className="max-w-full truncate font-mono text-label-14 text-gray-1000">{host}</p>
            ) : (
              <p className="text-copy-14 text-gray-900">{status === "FAILED" ? "No preview — the deployment failed." : "Preview appears once the deployment is live."}</p>
            )}
          </div>

          <dl className="grid content-start gap-x-6 gap-y-5 sm:grid-cols-2">
            <div>
              <dt className="text-label-13 text-gray-900">Status</dt>
              <dd className="mt-1.5 flex flex-wrap items-center gap-2">
                <StatusBadge status={status} />
                {isLiveNow && <Badge tone="green" size="sm">Serving traffic</Badge>}
                {status === "FAILED" && failureReason && <Badge tone="red" size="sm">{FAILURE_LABEL[failureReason]}</Badge>}
              </dd>
            </div>
            <div>
              <dt className="text-label-13 text-gray-900">{running ? "Running for" : "Duration"}</dt>
              <dd className="mt-1.5 text-label-14 text-gray-1000 tabular">{duration}</dd>
            </div>
            <div>
              <dt className="text-label-13 text-gray-900">Created</dt>
              <dd className="mt-1.5 flex flex-wrap items-center gap-x-2 text-label-14 text-gray-1000">
                <span title={absoluteTime(d.createdAt)}>{relativeTime(d.createdAt)}</span>
                <span className="text-gray-900">
                  <TriggerLabel trigger={d.trigger} />
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-label-13 text-gray-900">Deployment</dt>
              <dd className="mt-1.5 font-mono text-label-14 text-gray-1000">{d.id.slice(0, 8)}</dd>
            </div>
            {isLiveNow && p && host && (
              <div className="sm:col-span-2">
                <dt className="text-label-13 text-gray-900">Domains</dt>
                <dd className="mt-1.5 text-label-14">
                  <a href={p.liveUrl} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 rounded-sm font-mono text-gray-1000 hover:underline focus-ring">
                    <span className="truncate">{host}</span>
                    <ArrowUpRight className="size-4 shrink-0 text-gray-900" aria-hidden />
                  </a>
                </dd>
              </div>
            )}
            <div className="sm:col-span-2">
              <dt className="text-label-13 text-gray-900">Source</dt>
              <dd className="mt-1.5 space-y-1 text-label-14 text-gray-1000">
                <p className="flex items-center gap-1.5">
                  <GitBranch className="size-4 shrink-0 text-gray-900" aria-hidden />
                  <span className="truncate font-mono">{p?.branch ?? "—"}</span>
                </p>
                <p className="flex min-w-0 items-center gap-1.5">
                  <GitCommitHorizontal className="size-4 shrink-0 text-gray-900" aria-hidden />
                  {commitUrl ? (
                    <a href={commitUrl} target="_blank" rel="noreferrer" className="shrink-0 rounded-sm font-mono hover:underline focus-ring">
                      {shortSha(d.commitSha)}
                    </a>
                  ) : (
                    <span className="shrink-0 font-mono">{d.commitSha ? shortSha(d.commitSha) : "resolving…"}</span>
                  )}
                  {d.commitMessage && <span className="truncate text-gray-900">{d.commitMessage.split("\n")[0]}</span>}
                </p>
              </dd>
            </div>
            {d.rollbackOfId && (
              <div className="sm:col-span-2">
                <dt className="text-label-13 text-gray-900">{d.trigger === "RECOVERY" ? "Recovery of" : "Rollback of"}</dt>
                <dd className="mt-1.5 text-label-14">
                  <Link href={`/deployments/${d.rollbackOfId}`} className="inline-flex items-center gap-1.5 rounded-sm font-mono text-gray-1000 hover:underline focus-ring">
                    <Undo2 className="size-4 text-gray-900" aria-hidden />
                    {d.rollbackOfId.slice(0, 8)}
                  </Link>
                </dd>
              </div>
            )}
          </dl>
        </div>
        {status === "CANARY" && d.trafficPercent !== null && (
          <div className="rounded-b-lg border-t border-gray-alpha-400 bg-background-200 px-6 py-5">
            <TrafficSplit percent={d.trafficPercent} />
          </div>
        )}
      </Card>

      {/* Failure + agent */}
      {status === "FAILED" && (
        <div className="space-y-4">
          <AgentInsightCard key={d.id} deploymentId={d.id} />
          {d.failureDetail && (
            <Alert title={failureReason ? FAILURE_LABEL[failureReason] : "Deployment failed"}>
              <pre className="mt-1 font-mono text-label-13 break-words whitespace-pre-wrap">{d.failureDetail}</pre>
            </Alert>
          )}
        </div>
      )}

      {/* Deployment details */}
      <section aria-labelledby="details-heading" className="space-y-3">
        <h2 id="details-heading" className="text-heading-20 text-gray-1000">
          Deployment Details
        </h2>
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-gray-alpha-400 bg-background-200 px-4 py-2.5">
            <span className="text-label-14 font-medium text-gray-1000">Pipeline</span>
            {p && (
              <span className="text-label-13 text-gray-900">
                {p.rollout === "CANARY" ? "Canary rollout" : "Blue-green rollout"} · {p.replicas}× replicas
              </span>
            )}
          </div>
          <PipelineStepper
            layout="vertical"
            status={status}
            stoppedAt={stoppedStep(d, status, lastStep)}
            enteredAt={enteredAt}
            finishedAt={d.finishedAt}
            skipped={d.trigger === "ROLLBACK" || d.trigger === "RECOVERY" ? ["BUILDING"] : []}
            steps={steps}
          />
        </Card>

        <LogTerminal
          className="h-[560px] max-h-[75vh]"
          title="Build & deploy logs"
          lines={terminalLines}
          status={<StreamIndicator state={stream.state} />}
          empty={running ? "Waiting for the first log line…" : "No log output was recorded."}
        />
      </section>

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={cancel}
        loading={cancelling}
        danger
        title="Cancel this deployment?"
        description="The build stops and nothing is deployed. The currently live version keeps serving traffic."
        confirmLabel="Cancel deployment"
      />
      <RollbackDialog target={rollbackTarget} onClose={() => setRollbackTarget(null)} />
    </div>
  );
}
