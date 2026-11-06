"use client";

import { ArrowDown, Search, X } from "lucide-react";
import { memo, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cx } from "@/components/ui/cx";
import { clockTime, stripAnsi } from "@/lib/format";
import type { LogSource } from "@/lib/types";

export interface TerminalLine {
  key: string | number;
  line: string;
  source?: LogSource;
  ts?: string;
}

const SOURCE_STYLE: Record<LogSource, { text: string; bar: string }> = {
  BUILD: { text: "text-sky-400", bar: "bg-sky-500/50" },
  DEPLOY: { text: "text-brand-400", bar: "bg-brand-500/60" },
  RUNTIME: { text: "text-emerald-400", bar: "bg-emerald-500/50" },
  SYSTEM: { text: "text-amber-400", bar: "bg-amber-500/50" },
};

export function isAgentLine(l: Pick<TerminalLine, "source" | "line">): boolean {
  return l.source === "SYSTEM" && l.line.trimStart().startsWith("🤖");
}

const ERROR_RE = /\b(error|failed|failure|exception|fatal|panic)\b/i;
const WARN_RE = /\b(warn|warning|deprecated)\b/i;

function highlight(text: string, q: string): ReactNode {
  if (!q) return text;
  const lower = text.toLowerCase();
  const out: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (true) {
    const j = lower.indexOf(q, i);
    if (j < 0) break;
    out.push(text.slice(i, j), <mark key={k++} className="rounded-[2px] bg-brand-500/35 text-brand-50">{text.slice(j, j + q.length)}</mark>);
    i = j + q.length;
  }
  out.push(text.slice(i));
  return out;
}

const Row = memo(function Row({ l, n, q }: { l: TerminalLine; n: number; q: string }) {
  const agent = isAgentLine(l);
  const text = stripAnsi(l.line);
  const tone = agent ? "font-medium text-brand-200" : ERROR_RE.test(text) ? "text-red-300" : WARN_RE.test(text) ? "text-amber-200/90" : "text-zinc-300";
  return (
    <div className={cx("group flex hover:bg-white/[0.03]", agent && "my-1 bg-brand-500/[0.09] hover:bg-brand-500/[0.12]")}>
      <span className={cx("w-[3px] shrink-0", agent ? "bg-brand-500" : l.source ? SOURCE_STYLE[l.source].bar : "bg-transparent")} aria-hidden />
      <span className="w-12 shrink-0 pr-3 text-right text-zinc-700 select-none group-hover:text-zinc-500">{n}</span>
      {l.ts && <span className="hidden w-[4.5rem] shrink-0 text-zinc-600 select-none md:inline">{clockTime(l.ts)}</span>}
      {l.source && <span className={cx("hidden w-16 shrink-0 select-none sm:inline", SOURCE_STYLE[l.source].text)}>{l.source.toLowerCase()}</span>}
      <span className={cx("min-w-0 flex-1 pr-4 break-words whitespace-pre-wrap", tone)}>{highlight(text, q) || " "}</span>
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

/** Monospace log view with line numbers, search and a follow-tail toggle. */
export function LogTerminal({ lines, title, status, empty, className }: LogTerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<LogSource | "ALL">("ALL");
  const q = useDeferredValue(query.trim().toLowerCase());

  const sources = useMemo(() => {
    const s = new Set<LogSource>();
    for (const l of lines) if (l.source) s.add(l.source);
    return [...s];
  }, [lines]);

  const numbered = useMemo(() => {
    const out: { l: TerminalLine; n: number }[] = [];
    lines.forEach((l, i) => {
      if (source !== "ALL" && l.source !== source) return;
      if (q && !l.line.toLowerCase().includes(q)) return;
      out.push({ l, n: i + 1 });
    });
    return out;
  }, [lines, q, source]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && follow) el.scrollTop = el.scrollHeight;
  }, [numbered, follow]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
    if (!atBottom && follow) setFollow(false);
  };

  const filtering = !!q || source !== "ALL";

  return (
    <div className={cx("relative flex flex-col overflow-hidden rounded-lg border border-white/[0.08] bg-[#09090a]", className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-white/[0.06] bg-ink-900 px-3 py-2">
        {title && <span className="text-xs font-medium text-zinc-300">{title}</span>}
        <span className="font-mono text-[11px] text-zinc-500 tabular">
          {filtering ? `${numbered.length.toLocaleString()} / ` : ""}
          {lines.length.toLocaleString()} lines
        </span>
        {status && <span className="text-[11px] text-zinc-500">{status}</span>}
        <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
          {sources.length > 1 && (
            <select
              aria-label="Filter by source"
              value={source}
              onChange={(e) => setSource(e.target.value as LogSource | "ALL")}
              className="h-7 rounded border border-white/10 bg-ink-950 px-1.5 font-mono text-[11px] text-zinc-300 focus:ring-2 focus:ring-brand-500/40 focus:outline-none"
            >
              <option value="ALL">all sources</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s.toLowerCase()}
                </option>
              ))}
            </select>
          )}
          <label className="relative flex-1 sm:w-48 sm:flex-none">
            <span className="sr-only">Search logs</span>
            <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-zinc-600" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="h-7 w-full rounded border border-white/10 bg-ink-950 pr-6 pl-7 font-mono text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute top-1/2 right-1.5 -translate-y-1/2 text-zinc-500 hover:text-zinc-200">
                <X className="size-3" />
              </button>
            )}
          </label>
          <button
            type="button"
            role="switch"
            aria-checked={follow}
            onClick={() => setFollow((f) => !f)}
            className={cx(
              "flex h-7 shrink-0 items-center gap-1.5 rounded border px-2 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand-500/70 focus-visible:outline-none",
              follow ? "border-brand-500/40 bg-brand-500/10 text-brand-200" : "border-white/10 text-zinc-500 hover:text-zinc-200",
            )}
          >
            <ArrowDown className="size-3" aria-hidden />
            Follow
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        role="log"
        aria-live="off"
        aria-label={typeof title === "string" ? title : "Logs"}
        tabIndex={0}
        className="scrollbar-thin min-h-0 flex-1 overflow-y-auto py-2 font-mono text-[12px] leading-[1.65] focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none focus-visible:ring-inset"
      >
        {lines.length === 0 ? (
          <div className="px-4 text-zinc-600">{empty ?? "Waiting for output…"}</div>
        ) : numbered.length === 0 ? (
          <div className="px-4 text-zinc-600">No lines match.</div>
        ) : (
          numbered.map(({ l, n }) => <Row key={l.key} l={l} n={n} q={q} />)
        )}
      </div>
      {!follow && lines.length > 0 && (
        <button
          type="button"
          onClick={() => setFollow(true)}
          className="toast-in absolute bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/10 bg-ink-800/95 px-3 py-1.5 text-xs font-medium text-zinc-200 shadow-xl shadow-black/50 hover:bg-ink-700 focus-visible:ring-2 focus-visible:ring-brand-500/70 focus-visible:outline-none"
        >
          <ArrowDown className="size-3.5" aria-hidden />
          Jump to latest
        </button>
      )}
    </div>
  );
}

export function StreamIndicator({ state }: { state: string }) {
  const map: Record<string, { label: string; dot: string; pulse?: boolean }> = {
    connecting: { label: "Connecting", dot: "bg-zinc-400", pulse: true },
    open: { label: "Streaming", dot: "bg-emerald-400", pulse: true },
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
