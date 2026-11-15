"use client";

import { ChevronRight, GitBranch, GitCommitHorizontal, Rocket, Undo2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { RollbackDialog } from "@/components/deployment/RollbackDialog";
import { TriggerIcon } from "@/components/deployment/TriggerLabel";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, iconButtonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
      <Card className="divide-y divide-gray-alpha-400">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="px-6 py-4">
            <Skeleton className="h-9" />
          </div>
        ))}
      </Card>
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
      <Card className="overflow-hidden">
        <ul className="divide-y divide-gray-alpha-400">
          {rows.map((d) => {
            const isCurrent = project.liveDeploymentId === d.id;
            const running = isInProgress(d.status);
            return (
              <li
                key={d.id}
                className="group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-gray-alpha-100 md:grid-cols-[8rem_9rem_minmax(0,1fr)_9rem_2.5rem] md:px-6"
              >
                {/* Id + environment */}
                <div className="min-w-0">
                  <Link
                    href={`/deployments/${d.id}`}
                    className="block truncate font-mono text-label-14 font-medium text-gray-1000 after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:shadow-[inset_0_0_0_2px_var(--ds-blue-700)]"
                  >
                    {d.id.slice(0, 8)}
                  </Link>
                  <p className="mt-1 flex items-center gap-1.5 text-label-13 text-gray-900">
                    Production
                    {isCurrent && (
                      <Badge tone="blue" size="sm">
                        Current
                      </Badge>
                    )}
                  </p>
                </div>

                {/* Status + duration */}
                <div className="min-w-0 justify-self-end md:justify-self-auto">
                  <StatusBadge status={d.status} />
                  <p className="mt-1 text-label-13 text-gray-900 tabular md:pl-[18px]">
                    {d.startedAt ? durationBetween(d.startedAt, running ? null : d.finishedAt) : running ? "Waiting" : "—"}
                  </p>
                </div>

                {/* Source */}
                <div className="col-span-2 min-w-0 md:col-span-1">
                  <p className="flex items-center gap-1.5 text-label-14 text-gray-1000">
                    <GitBranch className="size-4 shrink-0 text-gray-900" aria-hidden />
                    <span className="truncate font-mono">{project.branch}</span>
                  </p>
                  <p className="mt-1 flex min-w-0 items-center gap-1.5 text-label-13 text-gray-900">
                    <GitCommitHorizontal className="size-4 shrink-0" aria-hidden />
                    <span className="shrink-0 font-mono">{shortSha(d.commitSha)}</span>
                    <span className="truncate text-gray-1000">{deploymentTitle(d)}</span>
                  </p>
                  {d.status === "FAILED" && d.failureReason && (
                    <p className="mt-1 text-label-13 text-red-900">{FAILURE_LABEL[d.failureReason]}</p>
                  )}
                </div>

                {/* When + who */}
                <div className="hidden min-w-0 text-right md:block">
                  <p className="text-label-14 text-gray-1000" title={absoluteTime(d.createdAt)}>
                    {relativeTime(d.createdAt)}
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-label-13 text-gray-900">
                    <TriggerIcon trigger={d.trigger} className="size-4" />
                    {TRIGGER_SHORT[d.trigger]}
                  </p>
                </div>

                {/* Actions */}
                <div className="relative z-10 col-span-2 flex justify-end empty:hidden md:col-span-1">
                  {canRollback(d) && !isCurrent ? (
                    <button
                      type="button"
                      className={iconButtonClass}
                      onClick={() => setRollbackTarget(d)}
                      aria-label={`Roll back to ${shortSha(d.commitSha)}`}
                      title="Roll back to this deployment"
                    >
                      <Undo2 className="size-4" aria-hidden />
                    </button>
                  ) : (
                    <ChevronRight className="hidden size-4 text-gray-900 transition-transform group-hover:translate-x-0.5 md:block" aria-hidden />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-label-14 text-gray-900">
          <span className="tabular">
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
