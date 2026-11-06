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
    <li className="group relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.025]">
      <div className={cx("shrink-0", compact ? "w-[6.5rem]" : "w-28")}>
        <StatusBadge status={d.status} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-2 text-[13px]">
          <span className="shrink-0 font-medium text-zinc-300">{d.projectName}</span>
          <span className="text-zinc-700" aria-hidden>/</span>
          <Link
            href={`/deployments/${d.id}`}
            className="truncate text-zinc-100 after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-brand-500/70 focus-visible:after:ring-inset"
          >
            {deploymentTitle(d)}
          </Link>
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-xs text-zinc-500">
          <span className="font-mono text-zinc-400">{shortSha(d.commitSha)}</span>
          <TriggerIcon trigger={d.trigger} className="size-3" />
          {d.status === "FAILED" && d.failureReason && <span className="text-red-400/90">{FAILURE_LABEL[d.failureReason]}</span>}
          <span className="sm:hidden">{relativeTime(d.createdAt)}</span>
        </p>
      </div>
      <div className="hidden shrink-0 text-right text-xs sm:block">
        <p className="text-zinc-400" title={absoluteTime(d.createdAt)}>
          {relativeTime(d.createdAt)}
        </p>
        <p className="mt-0.5 font-mono text-zinc-600 tabular">
          {d.startedAt ? durationBetween(d.startedAt, running ? null : d.finishedAt) : running ? "queued" : "—"}
        </p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-zinc-700 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-500" aria-hidden />
    </li>
  );
}

export function ActivitySkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-white/[0.05]">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="h-5 w-24 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </li>
      ))}
    </ul>
  );
}
