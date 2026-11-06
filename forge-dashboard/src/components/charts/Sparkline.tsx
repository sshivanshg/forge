import { useId } from "react";
import { cx } from "@/components/ui/cx";

interface SparklineProps {
  values: (number | null)[];
  className?: string;
  /** Tailwind text colour; the stroke uses currentColor. */
  tone?: string;
  fill?: boolean;
  /** Fixed y maximum; defaults to the series max. */
  max?: number;
  label?: string;
}

/** Tiny dependency-free line chart. Nulls break the line. */
export function Sparkline({ values, className, tone = "text-brand-400", fill = true, max, label }: SparklineProps) {
  const id = useId();
  const W = 100;
  const H = 30;
  const nums = values.filter((v): v is number => v !== null && Number.isFinite(v));
  const top = max ?? Math.max(1e-9, ...nums);
  const n = Math.max(values.length - 1, 1);
  const pts = values.map((v, i) =>
    v === null || !Number.isFinite(v) ? null : ([(i / n) * W, H - 2 - (Math.min(v, top) / top) * (H - 4)] as const),
  );
  let d = "";
  let pen = false;
  for (const p of pts) {
    if (!p) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${p[0].toFixed(2)} ${p[1].toFixed(2)} `;
    pen = true;
  }
  const valid = pts.filter((p): p is readonly [number, number] => !!p);
  const area =
    valid.length > 1 ? `M${valid[0][0]} ${H} ${valid.map((p) => `L${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ")} L${valid[valid.length - 1][0]} ${H} Z` : "";
  const last = valid[valid.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cx("overflow-visible", tone, className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && area && <path d={area} fill={`url(#${id})`} />}
      {valid.length > 0 && (
        <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      )}
      {last && <circle cx={last[0]} cy={last[1]} r="1.6" fill="currentColor" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}
