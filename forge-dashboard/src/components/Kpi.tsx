import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/Skeleton";

interface KpiProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  loading?: boolean;
  chart?: ReactNode;
}

export function Kpi({ label, value, sub, loading, chart }: KpiProps) {
  return (
    <div className="relative flex min-h-[104px] flex-col justify-between overflow-hidden bg-ink-900 px-4 py-3.5">
      <p className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">{label}</p>
      {loading ? (
        <Skeleton className="mt-3 h-7 w-16" />
      ) : (
        <div className="mt-2 flex items-end justify-between gap-2">
          <p className="text-[26px] leading-none font-semibold tracking-tight text-zinc-50 tabular">{value}</p>
          {chart && <div className="h-7 w-16 shrink-0">{chart}</div>}
        </div>
      )}
      <p className="mt-2 h-4 truncate text-xs text-zinc-500">{loading ? "" : sub}</p>
    </div>
  );
}

/** Tiles share hairline dividers instead of each being a card. */
export function KpiGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/[0.07] bg-white/[0.07] sm:grid-cols-3 lg:grid-cols-5">
      {children}
    </div>
  );
}
