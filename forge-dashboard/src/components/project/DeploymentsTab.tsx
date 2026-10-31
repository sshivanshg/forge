"use client";

import { ChevronRight, Rocket, Undo2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { RollbackDialog } from "@/components/deployment/RollbackDialog";
import { TriggerIcon } from "@/components/deployment/TriggerLabel";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api";
import { absoluteTime, durationBetween, relativeTime, shortSha } from "@/lib/format";
import { useQuery, useTick } from "@/lib/hooks";
import { canRollback, deploymentTitle, FAILURE_LABEL, isInProgress } from "@/lib/status";
import type { Deployment, Project } from "@/lib/types";

const PAGE_SIZE = 15;

const TRIGGER_SHORT: Record<Deployment["trigger"], string> = {
  MANUAL: "manual",
  WEBHOOK: "push",
  ROLLBACK: "rollback",
  RECOVERY: "auto-recovery",
};

interface Props {
  project: Project;
  onDeploy: () => void;
  deploying: boolean;
}

export function DeploymentsTab({ project, onDeploy, deploying }: Props) {
  const [page, setPage] = useState(0);
  const history = useQuery(`deployments:${project.id}:${page}`, () => api.deployments.list(project.id, page, PAGE_SIZE));
  const [rollbackTarget, setRollbackTarget] = useState<Deployment | null>(null);
  const rows = history.data?.content;
  const anyRunning = !!rows?.some((d) => isInProgress(d.status));

  // Refresh while something is building so statuses move without a reload.
  const reload = history.reload;
  useEffect(() => {
    if (!anyRunning) return;
    const timer = window.setInterval(reload, 3000);
    return () => window.clearInterval(timer);
  }, [anyRunning, reload]);
  useTick(anyRunning ? 1000 : 30_000);

  if (history.error && !rows) {
    return <Alert action={<Button size="sm" onClick={history.reload}>Retry</Button>}>{history.error.message}</Alert>;
  }

  if (!rows) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    );
  }

  if (rows.length === 0 && page === 0) {
    return (
      <EmptyState
        icon={<Rocket className="size-5" aria-hidden />}
        title="No deployments yet"
        description="Kick off the first build. Forge clones the repo, builds an image, starts it and health-checks it before switching traffic."
        action={
          <Button variant="primary" onClick={onDeploy} loading={deploying} icon={<Rocket className="size-4" aria-hidden />}>
            Deploy now
          </Button>
        }
      />
    );
  }

  const totalPages = history.data?.totalPages ?? 1;

  return (
    <>
      <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-900/30">
        {rows.map((d) => {
          const isCurrent = project.liveDeploymentId === d.id;
          const running = isInProgress(d.status);
          return (
            <li key={d.id} className="group relative flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-white/[0.03] sm:px-5">
              <div className="w-28 shrink-0">
                <StatusBadge status={d.status} />
              </div>

              <div className="min-w-0 flex-1">
                <Link
                  href={`/deployments/${d.id}`}
                  className="block truncate text-[13px] font-medium text-zinc-100 after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-violet-500/70 focus-visible:after:ring-inset"
                >
                  {deploymentTitle(d)}
                </Link>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
                  <span className="font-mono text-zinc-400">{shortSha(d.commitSha)}</span>
                  <span className="inline-flex items-center gap-1">
                    <TriggerIcon trigger={d.trigger} className="size-3" />
                    {TRIGGER_SHORT[d.trigger]}
                  </span>
                  {isCurrent && <span className="font-medium text-emerald-400">● current</span>}
                  {d.status === "FAILED" && d.failureReason && (
                    <span className="text-red-400/90">{FAILURE_LABEL[d.failureReason]}</span>
                  )}
                </p>
              </div>

              <div className="hidden shrink-0 text-right text-xs sm:block">
                <p className="text-zinc-400" title={absoluteTime(d.createdAt)}>
                  {relativeTime(d.createdAt)}
                </p>
                <p className="mt-0.5 font-mono text-zinc-600 tabular-nums">
                  {d.startedAt ? durationBetween(d.startedAt, running ? null : d.finishedAt) : running ? "waiting" : "—"}
                </p>
              </div>

              <div className="relative z-10 flex w-24 shrink-0 justify-end">
                {canRollback(d) && !isCurrent ? (
                  <Button size="sm" variant="ghost" onClick={() => setRollbackTarget(d)} icon={<Undo2 className="size-3.5" aria-hidden />}>
                    Rollback
                  </Button>
                ) : (
                  <ChevronRight className="size-4 text-zinc-600 transition-transform group-hover:translate-x-0.5" aria-hidden />
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-[13px] text-zinc-500">
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Newer
            </Button>
            <Button size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Older
            </Button>
          </div>
        </div>
      )}

      <RollbackDialog target={rollbackTarget} onClose={() => setRollbackTarget(null)} />
    </>
  );
}
