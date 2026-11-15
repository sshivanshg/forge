"use client";

import { Activity } from "lucide-react";
import { useEffect, useState } from "react";
import { ActivityRow, ActivitySkeleton } from "@/components/ActivityFeed";
import { PageHeader } from "@/components/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { cx } from "@/components/ui/cx";
import { useQuery, useTick } from "@/lib/hooks";
import { fetchActivity, isSucceeded } from "@/lib/insights";
import { isInProgress } from "@/lib/status";
import type { ActivityItem } from "@/lib/types";

const FILTERS = [
  { id: "all", label: "All", test: () => true },
  { id: "running", label: "In progress", test: (d: ActivityItem) => isInProgress(d.status) },
  { id: "live", label: "Succeeded", test: (d: ActivityItem) => isSucceeded(d) },
  { id: "failed", label: "Failed", test: (d: ActivityItem) => d.status === "FAILED" },
  { id: "cancelled", label: "Cancelled", test: (d: ActivityItem) => d.status === "CANCELLED" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

export default function ActivityPage() {
  const [filter, setFilter] = useState<FilterId>("all");
  const activity = useQuery("activity:100", () => fetchActivity(100));
  const items = activity.data;
  const anyRunning = !!items?.some((d) => isInProgress(d.status));
  useTick(anyRunning ? 1000 : 30_000);

  const reload = activity.reload;
  useEffect(() => {
    const t = window.setInterval(reload, anyRunning ? 4000 : 20_000);
    return () => window.clearInterval(t);
  }, [anyRunning, reload]);

  const shown = items?.filter(FILTERS.find((f) => f.id === filter)!.test);

  return (
    <>
      <PageHeader title="Activity" description="Every deployment across your projects, newest first." />

      <div role="radiogroup" aria-label="Filter by status" className="mb-4 flex w-fit max-w-full gap-1 overflow-x-auto rounded-md border border-gray-alpha-400 bg-background-100 p-1">
        {FILTERS.map((f) => {
          const count = items?.filter(f.test).length;
          const on = f.id === filter;
          return (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setFilter(f.id)}
              className={cx(
                "flex h-7 shrink-0 items-center gap-2 rounded-sm px-2.5 text-label-14 transition-colors focus-ring",
                on ? "bg-gray-alpha-200 text-gray-1000" : "text-gray-900 hover:bg-gray-alpha-100 hover:text-gray-1000",
              )}
            >
              {f.label}
              {count !== undefined && <span className={cx("text-label-12 tabular", on ? "text-gray-1000" : "text-gray-900")}>{count}</span>}
            </button>
          );
        })}
      </div>

      {activity.error && !items ? (
        <Alert action={<Button size="sm" onClick={activity.reload}>Retry</Button>}>{activity.error.message}</Alert>
      ) : !shown ? (
        <div className="overflow-hidden rounded-lg border border-gray-alpha-400 bg-background-100">
          <ActivitySkeleton rows={8} />
        </div>
      ) : shown.length === 0 ? (
        <EmptyState
          icon={<Activity className="size-5" aria-hidden />}
          title={filter === "all" ? "No deployments yet" : "Nothing matches this filter"}
          description={filter === "all" ? "Deployments from every project show up here as they happen." : "Try another status."}
          action={filter !== "all" ? <Button size="sm" onClick={() => setFilter("all")}>Show all</Button> : undefined}
        />
      ) : (
        <ul className="divide-y divide-gray-alpha-400 overflow-hidden rounded-lg border border-gray-alpha-400 bg-background-100">
          {shown.map((d) => (
            <ActivityRow key={d.id} d={d} />
          ))}
        </ul>
      )}
    </>
  );
}
