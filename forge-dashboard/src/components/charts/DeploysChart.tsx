"use client";

import { useState } from "react";
import type { DeploysByDay } from "@/lib/types";

function label(date: string, opts: Intl.DateTimeFormatOptions) {
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString(undefined, opts);
}

/** Stacked bars: succeeded (ember-neutral) under failed (red), one per day. */
export function DeploysChart({ days }: { days: DeploysByDay[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const H = 140;
  const max = Math.max(1, ...days.map((d) => d.succeeded + d.failed));
  const ticks = max <= 4 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, Math.round(max / 2), max];
  const total = days.reduce((a, d) => a + d.succeeded + d.failed, 0);
  const active = hover !== null ? days[hover] : null;

  return (
    <div>
      <div className="mb-3 flex h-5 items-center gap-4 text-xs text-zinc-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-[2px] bg-zinc-300" /> Succeeded
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-[2px] bg-red-500" /> Failed
        </span>
        <span className="ml-auto font-mono text-zinc-400 tabular">
          {active
            ? `${label(active.date, { month: "short", day: "numeric" })} · ${active.succeeded} ok · ${active.failed} failed`
            : `${total} deploys`}
        </span>
      </div>
      <div className="flex gap-2">
        <div className="relative w-5 shrink-0 font-mono text-[10px] text-zinc-600 tabular" style={{ height: H }} aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: H - (t / max) * H }}>
              {t}
            </span>
          ))}
        </div>
        <div className="relative flex-1" style={{ height: H }}>
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-dashed border-white/[0.06]" style={{ top: H - (t / max) * H }} aria-hidden />
          ))}
          <ul
            className="relative flex h-full items-end gap-[3px] sm:gap-1.5"
            aria-label="Deployments per day, last 14 days"
            onMouseLeave={() => setHover(null)}
          >
            {days.map((d, i) => {
              const okH = (d.succeeded / max) * H;
              const failH = (d.failed / max) * H;
              return (
                <li
                  key={d.date}
                  className="group relative flex h-full flex-1 flex-col justify-end"
                  onMouseEnter={() => setHover(i)}
                  aria-label={`${label(d.date, { month: "short", day: "numeric" })}: ${d.succeeded} succeeded, ${d.failed} failed`}
                >
                  <div className={hover === i ? "absolute inset-0 -mx-0.5 rounded-sm bg-white/[0.04]" : "hidden"} aria-hidden />
                  {failH > 0 && <div className="relative rounded-t-[2px] bg-red-500/90" style={{ height: failH }} />}
                  {okH > 0 && (
                    <div
                      className={`relative bg-zinc-300/80 transition-colors group-hover:bg-zinc-100 ${failH > 0 ? "" : "rounded-t-[2px]"}`}
                      style={{ height: okH }}
                    />
                  )}
                  {okH + failH === 0 && <div className="relative h-px bg-white/10" />}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <div className="mt-2 ml-7 flex justify-between font-mono text-[10px] text-zinc-600" aria-hidden>
        <span>{days[0] && label(days[0].date, { month: "short", day: "numeric" })}</span>
        <span>{days[Math.floor(days.length / 2)] && label(days[Math.floor(days.length / 2)].date, { month: "short", day: "numeric" })}</span>
        <span>Today</span>
      </div>
    </div>
  );
}
