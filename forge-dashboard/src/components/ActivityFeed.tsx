"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { TriggerIcon } from "@/components/deployment/TriggerLabel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { cx } from "@/components/ui/cx";
import { absoluteTime, durationBetween, relativeTime, shortSha } from "@/lib/format";
import { deploymentTitle, FAILURE_LABEL, isInProgress } from "@/lib/status";
import type { ActivityItem } from "@/lib/types";

export function ActivityRow({ d, compact }: { d: ActivityItem; compact?: boolean }) {
  const running = isInProgress(d.status);
  return (
    <li className="group relative flex items-center gap-4 px-4 py-3 transition-colors hover:bg-gray-alpha-100">
      <div className={cx("shrink-0", compact ? "w-[6.5rem]" : "w-32")}>
        <StatusBadge status={d.status} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-2 text-label-14">
          <span className="shrink-0 font-medium text-gray-1000">{d.projectName}</span>
          <span className="text-gray-alpha-500" aria-hidden>
            /
          </span>
          <Link
            href={`/deployments/${d.id}`}
            className="truncate text-gray-1000 after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none focus-visible:after:shadow-[inset_0_0_0_2px_var(--ds-blue-700)]"
          >
            {deploymentTitle(d)}
          </Link>
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2.5 text-label-13 text-gray-900">
          <span className="font-mono">{shortSha(d.commitSha)}</span>
          <TriggerIcon trigger={d.trigger} className="size-3.5 text-gray-900" />
          {d.status === "FAILED" && d.failureReason && <span className="text-red-900">{FAILURE_LABEL[d.failureReason]}</span>}
          <span className="sm:hidden">{relativeTime(d.createdAt)}</span>
        </p>
      </div>
      <div className="hidden shrink-0 text-right sm:block">
        <p className="text-label-13 text-gray-900" title={absoluteTime(d.createdAt)}>
          {relativeTime(d.createdAt)}
        </p>
        <p className="mt-1 font-mono text-label-12 text-gray-900 tabular">
          {d.startedAt ? durationBetween(d.startedAt, running ? null : d.finishedAt) : running ? "queued" : "—"}
        </p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-gray-700 transition-colors group-hover:text-gray-1000" aria-hidden />
    </li>
  );
}

export function ActivitySkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-gray-alpha-400">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-4 px-4 py-3.5">
          <Skeleton className="h-4 w-24" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </li>
      ))}
    </ul>
  );
}
