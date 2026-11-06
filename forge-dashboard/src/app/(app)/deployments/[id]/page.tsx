"use client";

import { ArrowUpRight, ChevronRight, CircleStop, GitCommitHorizontal, Undo2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentInsightCard } from "@/components/deployment/AgentInsightCard";
import { PipelineStepper } from "@/components/deployment/PipelineStepper";
import { RollbackDialog } from "@/components/deployment/RollbackDialog";
import { TrafficSplit } from "@/components/deployment/TrafficSplit";
import { TriggerLabel } from "@/components/deployment/TriggerLabel";
import { LogTerminal, StreamIndicator, type TerminalLine } from "@/components/LogTerminal";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
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
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-8 w-96 max-w-full" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-[420px] rounded-xl" />
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

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] text-zinc-500">
        <Link href="/projects" className="hover:text-zinc-200">
          Projects
        </Link>
        <ChevronRight className="size-3.5" aria-hidden />
        {p ? (
          <Link href={`/projects/${p.id}`} className="truncate hover:text-zinc-200">
            {p.name}
          </Link>
        ) : (
          <Skeleton className="h-3.5 w-20" />
        )}
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="font-mono text-zinc-400" aria-current="page">
          {d.id.slice(0, 8)}
        </span>
      </nav>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={status} />
            {isLiveNow && <span className="text-xs font-medium text-emerald-400">Serving traffic</span>}
          </div>
          <h1 className="truncate text-2xl font-semibold tracking-tight text-zinc-50">
            {deploymentTitle(d)}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-zinc-400">
            <span className="inline-flex items-center gap-1.5">
              <GitCommitHorizontal className="size-4 text-zinc-500" aria-hidden />
              {commitUrl ? (
                <a href={commitUrl} target="_blank" rel="noreferrer" className="font-mono hover:text-zinc-100 hover:underline">
                  {shortSha(d.commitSha)}
                </a>
              ) : (
                <span className="font-mono">{d.commitSha ? shortSha(d.commitSha) : "resolving…"}</span>
              )}
              {p && <span className="text-zinc-600">on {p.branch}</span>}
            </span>
            <TriggerLabel trigger={d.trigger} />
            <span title={absoluteTime(d.createdAt)}>Created {relativeTime(d.createdAt)}</span>
            {d.startedAt && (
              <span className="tabular-nums">
                {running ? "Running for " : "Took "}
                {durationBetween(d.startedAt, running ? null : d.finishedAt)}
              </span>
            )}
            {d.rollbackOfId && (
              <Link href={`/deployments/${d.rollbackOfId}`} className="inline-flex items-center gap-1 text-violet-400 hover:text-violet-300">
                <Undo2 className="size-3.5" aria-hidden /> {d.trigger === "RECOVERY" ? "Recovery of" : "Rollback of"} {d.rollbackOfId.slice(0, 8)}
              </Link>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {status === "LIVE" && p && (
            <a
              href={p.liveUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:outline-none"
            >
              Visit <ArrowUpRight className="size-4" aria-hidden />
            </a>
          )}
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
        </div>
      </div>

      {/* Pipeline */}
      <Card className="px-4 py-6 sm:px-6">
        <PipelineStepper
          status={status}
          stoppedAt={stoppedStep(d, status, lastStep)}
          enteredAt={enteredAt}
          finishedAt={d.finishedAt}
          skipped={d.trigger === "ROLLBACK" || d.trigger === "RECOVERY" ? ["BUILDING"] : []}
          steps={steps}
        />
        {status === "CANARY" && d.trafficPercent !== null && (
          <TrafficSplit percent={d.trafficPercent} className="mx-auto mt-6 max-w-xl border-t border-white/[0.06] pt-5" />
        )}
      </Card>

      {/* Failure + agent */}
      {status === "FAILED" && (
        <div className="space-y-4">
          <Alert title={failureReason ? FAILURE_LABEL[failureReason] : "Deployment failed"}>
            {d.failureDetail ? (
              <pre className="mt-1 font-mono text-xs break-words whitespace-pre-wrap">{d.failureDetail}</pre>
            ) : (
              "The pipeline stopped. The agent's diagnosis is below."
            )}
          </Alert>
          <AgentInsightCard key={d.id} deploymentId={d.id} />
        </div>
      )}

      {/* Logs */}
      <LogTerminal
        className="h-[560px] max-h-[75vh]"
        title="Build & deploy log"
        lines={terminalLines}
        status={<StreamIndicator state={stream.state} />}
        empty={running ? "Waiting for the first log line…" : "No log output was recorded."}
      />

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
