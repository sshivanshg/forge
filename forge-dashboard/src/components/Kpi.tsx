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
    <div className="relative flex min-h-[112px] flex-col justify-between overflow-hidden bg-background-100 px-5 py-4">
      <p className="text-label-14 text-gray-900">{label}</p>
      {loading ? (
        <Skeleton className="mt-3 h-7 w-16" />
      ) : (
        <div className="mt-2 flex items-end justify-between gap-2">
          <p className="text-heading-32 text-gray-1000 tabular">{value}</p>
          {chart && <div className="h-7 w-16 shrink-0">{chart}</div>}
        </div>
      )}
      <p className="mt-2 h-4 truncate text-label-13 text-gray-900">{loading ? "" : sub}</p>
    </div>
  );
}

/** Tiles share hairline dividers instead of each being a card. */
export function KpiGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-gray-alpha-400 bg-gray-alpha-400 sm:grid-cols-3 lg:grid-cols-5">
      {children}
    </div>
  );
}
