import { cx } from "@/components/ui/cx";

const SEGMENTS = 40;

/** How the app's traffic is divided between the live version and the canary right now. */
export function TrafficSplit({ percent, className }: { percent: number; className?: string }) {
  const p = Math.max(0, Math.min(100, percent));
  const live = 100 - p;
  const lit = Math.round((p / 100) * SEGMENTS);
  return (
    <div className={cx("space-y-3", className)}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium tracking-wide text-cyan-400/80 uppercase">Canary · new version</p>
          <p className="font-mono text-2xl text-cyan-300 tabular transition-all">{p}%</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">Stable · live version</p>
          <p className="font-mono text-2xl text-zinc-300 tabular">{live}%</p>
        </div>
      </div>
      <div
        className="flex h-6 gap-[2px]"
        role="img"
        aria-label={`${p}% of traffic to the new version, ${live}% to the live version`}
      >
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span
            key={i}
            className={cx(
              "flex-1 rounded-[2px] transition-colors duration-500",
              i < lit ? "bg-cyan-400 shadow-[0_0_8px_rgb(34_211_238/0.35)]" : "bg-zinc-700/60",
            )}
            style={{ transitionDelay: `${(i < lit ? i : SEGMENTS - i) * 12}ms` }}
          />
        ))}
      </div>
      <p className="text-xs text-zinc-500">
        Forge compares the canary&apos;s error rate and latency with the stable version at every step and rolls back on
        its own if it regresses.
      </p>
    </div>
  );
}
