import { cx } from "@/components/ui/cx";

/** How the app's traffic is divided between the live version and the canary right now. */
export function TrafficSplit({ percent, className }: { percent: number; className?: string }) {
  const live = 100 - percent;
  return (
    <div className={cx("space-y-2", className)}>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-cyan-300">
          New version <span className="font-mono tabular-nums">{percent}%</span>
        </span>
        <span className="text-zinc-400">
          Live version <span className="font-mono tabular-nums">{live}%</span>
        </span>
      </div>
      <div
        className="flex h-2 overflow-hidden rounded-full bg-white/[0.06]"
        role="img"
        aria-label={`${percent}% of traffic to the new version, ${live}% to the live version`}
      >
        <div className="h-full bg-cyan-400 transition-[width] duration-700 ease-out" style={{ width: `${percent}%` }} />
        <div className="h-full flex-1 bg-emerald-500/40" />
      </div>
      <p className="text-xs text-zinc-500">
        Forge compares the new version&apos;s error rate and latency with the live version&apos;s at each step and
        rolls back on its own if it is worse.
      </p>
    </div>
  );
}
