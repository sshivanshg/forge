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

/** Sources stay monochrome; the label column is enough to tell them apart. */
const SOURCE_TEXT = "text-gray-900";

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
    out.push(text.slice(i, j), <mark key={k++} className="rounded-sm bg-amber-200 text-gray-1000">{text.slice(j, j + q.length)}</mark>);
    i = j + q.length;
  }
  out.push(text.slice(i));
  return out;
}

const Row = memo(function Row({ l, n, q }: { l: TerminalLine; n: number; q: string }) {
  const agent = isAgentLine(l);
  const raw = stripAnsi(l.line);
  // The agent prefixes its lines with a robot emoji; the purple row already marks them.
  const text = agent ? raw.replace(/^\s*\u{1F916}\s*/u, "") : raw;
  const error = !agent && ERROR_RE.test(text);
  const warn = !agent && !error && WARN_RE.test(text);
  const tone = agent ? "text-purple-900" : error ? "text-red-900" : warn ? "text-amber-900" : "text-gray-1000";
  return (
    <div
      className={cx(
        "group flex",
        agent ? "bg-purple-100" : error ? "bg-red-100" : warn ? "bg-amber-100" : "hover:bg-gray-alpha-100",
      )}
    >
      <span className="w-12 shrink-0 pr-3 text-right text-gray-700 select-none">{n}</span>
      {l.ts && <span className="hidden w-[4.75rem] shrink-0 text-gray-900 select-none md:inline">{clockTime(l.ts)}</span>}
      {l.source && (
        <span className={cx("hidden w-16 shrink-0 select-none sm:inline", agent ? "text-purple-900" : SOURCE_TEXT)}>
          {agent ? "agent" : l.source.toLowerCase()}
        </span>
      )}
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
    <div className={cx("relative flex flex-col overflow-hidden rounded-lg border border-gray-alpha-400 bg-background-100", className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-gray-alpha-400 px-3 py-2">
        {title && <span className="text-label-14 font-medium text-gray-1000">{title}</span>}
        <span className="text-label-13 text-gray-900 tabular">
          {filtering ? `${numbered.length.toLocaleString()} / ` : ""}
          {lines.length.toLocaleString()} lines
        </span>
        {status && <span className="text-label-13 text-gray-900">{status}</span>}
        <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
          {sources.length > 1 && (
            <select
              aria-label="Filter by source"
              value={source}
              onChange={(e) => setSource(e.target.value as LogSource | "ALL")}
              className="h-8 rounded-md border border-gray-alpha-400 bg-background-100 px-2 text-label-13 text-gray-1000 hover:border-gray-alpha-500 focus-ring"
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
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-gray-900" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="h-8 w-full rounded-md border border-gray-alpha-400 bg-background-100 pr-7 pl-8 text-label-13 text-gray-1000 placeholder:text-gray-700 hover:border-gray-alpha-500 focus:border-gray-alpha-600 focus:shadow-[0_0_0_3px_var(--ds-gray-alpha-300)] focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-sm p-0.5 text-gray-900 hover:text-gray-1000 focus-ring"
              >
                <X className="size-3.5" />
              </button>
            )}
          </label>
          <button
            type="button"
            role="switch"
            aria-checked={follow}
            onClick={() => setFollow((f) => !f)}
            className={cx(
              "flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-label-13 font-medium transition-colors focus-ring",
              follow ? "bg-gray-1000 text-background-100" : "shadow-border text-gray-900 hover:bg-gray-alpha-200 hover:text-gray-1000",
            )}
          >
            <ArrowDown className="size-3.5" aria-hidden />
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
        className="scrollbar-thin min-h-0 flex-1 overflow-y-auto py-2 font-mono text-label-13 leading-[20px] focus-visible:shadow-[inset_0_0_0_2px_var(--ds-blue-700)] focus-visible:outline-none"
      >
        {lines.length === 0 ? (
          <div className="px-4 text-gray-900">{empty ?? "Waiting for output…"}</div>
        ) : numbered.length === 0 ? (
          <div className="px-4 text-gray-900">No lines match.</div>
        ) : (
          numbered.map(({ l, n }) => <Row key={l.key} l={l} n={n} q={q} />)
        )}
      </div>
      {!follow && lines.length > 0 && (
        <button
          type="button"
          onClick={() => setFollow(true)}
          className="toast-in absolute bottom-4 left-1/2 inline-flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full bg-background-100 px-3 text-label-13 font-medium text-gray-1000 shadow-menu hover:bg-gray-100 focus-ring"
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
    connecting: { label: "Connecting", dot: "bg-gray-700", pulse: true },
    open: { label: "Streaming", dot: "bg-green-700", pulse: true },
    reconnecting: { label: "Reconnecting", dot: "bg-amber-700", pulse: true },
    closed: { label: "Ended", dot: "bg-gray-700" },
    error: { label: "Disconnected", dot: "bg-red-700" },
  };
  const m = map[state] ?? map.closed;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative inline-flex size-2">
        {m.pulse && <span className={cx("absolute inset-0 animate-ping rounded-full opacity-50", m.dot)} />}
        <span className={cx("relative inline-flex size-2 rounded-full", m.dot)} />
      </span>
      {m.label}
    </span>
  );
}
