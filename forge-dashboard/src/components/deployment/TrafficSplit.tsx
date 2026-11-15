import { cx } from "@/components/ui/cx";

/** How the app's traffic is divided between the live version and the canary right now. */
export function TrafficSplit({ percent, className }: { percent: number; className?: string }) {
  const p = Math.max(0, Math.min(100, percent));
  const live = 100 - p;
  return (
    <div className={cx("space-y-3", className)}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-label-13 text-gray-900">
            <span className="size-2 rounded-full bg-blue-700" aria-hidden />
            Canary (new version)
          </p>
          <p className="mt-1 text-heading-24 text-gray-1000 tabular">{p}%</p>
        </div>
        <div className="text-right">
          <p className="flex items-center justify-end gap-1.5 text-label-13 text-gray-900">
            <span className="size-2 rounded-full bg-gray-1000" aria-hidden />
            Stable (live version)
          </p>
          <p className="mt-1 text-heading-24 text-gray-1000 tabular">{live}%</p>
        </div>
      </div>
      <div
        className="flex h-2 overflow-hidden rounded-full bg-gray-200"
        role="img"
        aria-label={`${p}% of traffic to the new version, ${live}% to the live version`}
      >
        <span className="h-full bg-blue-700 transition-[width] duration-700" style={{ width: `${p}%` }} />
        <span className="h-full flex-1 bg-gray-1000" style={{ opacity: live > 0 ? 1 : 0 }} />
      </div>
      <p className="text-copy-13 text-gray-900">
        Forge compares the canary&apos;s error rate and latency with the stable version at every step and rolls back on
        its own if it regresses.
      </p>
    </div>
  );
}
