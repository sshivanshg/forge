"use client";

import { ArrowDown } from "lucide-react";
import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { clockTime, stripAnsi } from "@/lib/format";
import type { LogSource } from "@/lib/types";

export interface TerminalLine {
  key: string | number;
  line: string;
  source?: LogSource;
  ts?: string;
}

const SOURCE_STYLE: Record<LogSource, string> = {
  BUILD: "text-sky-400",
  DEPLOY: "text-violet-400",
  RUNTIME: "text-emerald-400",
  SYSTEM: "text-amber-400",
};

export function isAgentLine(l: Pick<TerminalLine, "source" | "line">): boolean {
  return l.source === "SYSTEM" && l.line.trimStart().startsWith("🤖");
}

const Row = memo(function Row({ l }: { l: TerminalLine }) {
  const agent = isAgentLine(l);
  return (
    <div
      className={cx(
        "group flex gap-3 px-4 py-px hover:bg-white/[0.03]",
        agent && "my-1 border-l-2 border-violet-500 bg-violet-500/[0.09] py-1 hover:bg-violet-500/[0.12]",
      )}
    >
      {l.ts && <span className="hidden shrink-0 text-zinc-600 select-none sm:inline">{clockTime(l.ts)}</span>}
      {l.source && (
        <span className={cx("w-14 shrink-0 select-none", SOURCE_STYLE[l.source])}>{l.source}</span>
      )}
      <span className={cx("min-w-0 flex-1 break-words whitespace-pre-wrap", agent ? "font-medium text-violet-200" : "text-zinc-300")}>
        {stripAnsi(l.line) || " "}
      </span>
    </div>
  );
});

interface LogTerminalProps {
  lines: TerminalLine[];
  title?: ReactNode;
  status?: ReactNode;
  empty?: ReactNode;
  className?: string;
}

/** Dark, monospace log view that follows new output until the user scrolls up. */
export function LogTerminal({ lines, title, status, empty, className }: LogTerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && follow) el.scrollTop = el.scrollHeight;
  }, [lines, follow]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
    if (atBottom !== follow) setFollow(atBottom);
  };

  return (
    <div className={cx("relative flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#0b0b0e]", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] bg-white/[0.02] px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-zinc-700" />
            <span className="size-2.5 rounded-full bg-zinc-700" />
            <span className="size-2.5 rounded-full bg-zinc-700" />
          </span>
          {title && <span className="text-xs font-medium text-zinc-400">{title}</span>}
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span className="tabular-nums">{lines.length.toLocaleString()} lines</span>
          {status}
        </div>
      </div>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        role="log"
        aria-live="off"
        aria-label={typeof title === "string" ? title : "Logs"}
        tabIndex={0}
        className="scrollbar-thin min-h-0 flex-1 overflow-y-auto py-3 font-mono text-[12.5px] leading-[1.6] focus-visible:outline-none"
      >
        {lines.length === 0 ? (
          <div className="px-4 text-zinc-600">{empty ?? "Waiting for output…"}</div>
        ) : (
          lines.map((l) => <Row key={l.key} l={l} />)
        )}
      </div>
      {!follow && lines.length > 0 && (
        <button
          type="button"
          onClick={() => setFollow(true)}
          className="toast-in absolute bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/10 bg-zinc-800/95 px-3 py-1.5 text-xs font-medium text-zinc-200 shadow-xl shadow-black/50 hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-violet-500/70 focus-visible:outline-none"
        >
          <ArrowDown className="size-3.5" aria-hidden />
          Jump to bottom
        </button>
      )}
    </div>
  );
}

export function StreamIndicator({ state }: { state: string }) {
  const map: Record<string, { label: string; dot: string; pulse?: boolean }> = {
    connecting: { label: "Connecting", dot: "bg-zinc-400", pulse: true },
    open: { label: "Live", dot: "bg-emerald-400", pulse: true },
    reconnecting: { label: "Reconnecting", dot: "bg-amber-400", pulse: true },
    closed: { label: "Ended", dot: "bg-zinc-600" },
    error: { label: "Disconnected", dot: "bg-red-400" },
  };
  const m = map[state] ?? map.closed;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative inline-flex size-1.5">
        {m.pulse && <span className={cx("absolute inset-0 animate-ping rounded-full opacity-70", m.dot)} />}
        <span className={cx("relative inline-flex size-1.5 rounded-full", m.dot)} />
      </span>
      {m.label}
    </span>
  );
}
