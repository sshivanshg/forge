"use client";

import { Bot, RotateCw, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { cx } from "@/components/ui/cx";
import { api, ApiError } from "@/lib/api";
import { humanize } from "@/lib/format";
import type { Confidence, Insight } from "@/lib/types";

const POLL_MS = 2000;
const MAX_ATTEMPTS = 15; // ~30 s

type Phase = "thinking" | "ready" | "timeout" | "error";

const CONFIDENCE: Record<Confidence, { pct: number; bar: string; text: string }> = {
  HIGH: { pct: 90, bar: "bg-emerald-400", text: "text-emerald-300" },
  MEDIUM: { pct: 60, bar: "bg-amber-400", text: "text-amber-300" },
  LOW: { pct: 30, bar: "bg-zinc-400", text: "text-zinc-300" },
};

/** Polls the agent's diagnosis of a failed deployment; it appears a few seconds after failure. */
function useInsight(deploymentId: string) {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [phase, setPhase] = useState<Phase>("thinking");
  const [message, setMessage] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let attempts = 0;

    const poll = () => {
      attempts += 1;
      api.deployments.insight(deploymentId).then(
        (result) => {
          if (cancelled) return;
          setInsight(result);
          setPhase("ready");
        },
        (err: unknown) => {
          if (cancelled) return;
          const notYet = err instanceof ApiError && err.status === 404;
          if (notYet && attempts < MAX_ATTEMPTS) {
            timer = window.setTimeout(poll, POLL_MS);
          } else if (notYet) {
            setPhase("timeout");
          } else {
            setMessage(err instanceof Error ? err.message : String(err));
            setPhase("error");
          }
        },
      );
    };
    poll();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [deploymentId, generation]);

  const retry = () => {
    setPhase("thinking");
    setMessage(null);
    setGeneration((g) => g + 1);
  };

  return { insight, phase, message, retry };
}

function ConfidenceMeter({ level }: { level: Confidence }) {
  const c = CONFIDENCE[level];
  return (
    <div className="min-w-[9rem]">
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="font-medium tracking-wide text-zinc-500 uppercase">Confidence</span>
        <span className={cx("font-mono font-medium", c.text)}>{humanize(level)}</span>
      </div>
      <div className="mt-1.5 flex gap-[3px]" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={c.pct} aria-label={`${humanize(level)} confidence`}>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={cx("h-1.5 flex-1 rounded-[1px]", i < c.pct / 10 ? c.bar : "bg-white/[0.08]")} />
        ))}
      </div>
    </div>
  );
}

export function AgentInsightCard({ deploymentId }: { deploymentId: string }) {
  const { insight, phase, message, retry } = useInsight(deploymentId);

  return (
    <section
      aria-labelledby="agent-heading"
      aria-busy={phase === "thinking"}
      className="ember-edge relative overflow-hidden rounded-lg border border-brand-500/30 bg-ink-900"
    >
      <div className="absolute inset-y-0 left-0 w-[3px] bg-brand-500" aria-hidden />
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] py-3.5 pr-5 pl-6">
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-md bg-brand-500/15 text-brand-300 ring-1 ring-brand-400/30">
            <Bot className="size-4" aria-hidden />
          </span>
          <div>
            <h2 id="agent-heading" className="text-sm font-semibold text-zinc-50">
              Forge Agent · diagnosis
            </h2>
            <p className="text-xs text-zinc-500">
              {phase === "thinking"
                ? "Reading the logs and the failure…"
                : phase === "ready" && insight
                  ? <>Root cause analysis · engine <span className="font-mono text-zinc-400">{insight.engine}</span></>
                  : "No diagnosis available"}
            </p>
          </div>
        </div>
        {insight && (
          <div className="flex flex-wrap items-center gap-5">
            <div>
              <p className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">Category</p>
              <p className="mt-0.5 font-mono text-[13px] text-brand-200">{insight.category}</p>
            </div>
            <ConfidenceMeter level={insight.confidence} />
          </div>
        )}
      </header>

      <div className="py-5 pr-5 pl-6">
        {phase === "thinking" && (
          <div className="space-y-3" role="status">
            <p className="flex items-center gap-2 text-[13px] text-brand-200">
              <span className="flex gap-1" aria-hidden>
                <span className="size-1.5 animate-bounce rounded-full bg-brand-400 [animation-delay:-0.3s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-brand-400 [animation-delay:-0.15s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-brand-400" />
              </span>
              Analysing
            </p>
            <Skeleton className="h-4 w-11/12 bg-brand-400/10" />
            <Skeleton className="h-4 w-4/5 bg-brand-400/10" />
            <Skeleton className="mt-4 h-16 w-full bg-brand-400/10" />
          </div>
        )}

        {(phase === "timeout" || phase === "error") && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-zinc-400">
              {phase === "timeout"
                ? "The agent hasn't posted a diagnosis yet. It may still be working, or the agent is disabled on this server."
                : message}
            </p>
            <Button size="sm" onClick={retry} icon={<RotateCw className="size-3.5" aria-hidden />}>
              Check again
            </Button>
          </div>
        )}

        {phase === "ready" && insight && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <div>
                <p className="mb-1.5 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">What happened</p>
                <p className="text-[15px] leading-relaxed text-zinc-100">{insight.summary}</p>
              </div>
              <div className="rounded-md border border-emerald-500/20 bg-emerald-500/[0.05] p-3.5">
                <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold tracking-wide text-emerald-300 uppercase">
                  <Wrench className="size-3.5" aria-hidden />
                  Suggested fix
                </p>
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-zinc-200">{insight.suggestedFix}</p>
              </div>
            </div>
            <div className="min-w-0">
              <p className="mb-1.5 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
                Evidence <span className="font-mono text-zinc-600">({insight.evidence.length})</span>
              </p>
              {insight.evidence.length === 0 ? (
                <p className="text-[13px] text-zinc-500">The agent didn&apos;t cite specific log lines.</p>
              ) : (
                <ol className="scrollbar-thin max-h-64 overflow-auto rounded-md border border-white/[0.06] bg-ink-950 py-1.5 font-mono text-xs leading-relaxed">
                  {insight.evidence.map((line, i) => (
                    <li key={i} className="flex gap-3 px-3 py-0.5">
                      <span className="w-4 shrink-0 text-right text-zinc-600 select-none">{i + 1}</span>
                      <span className="min-w-0 break-words whitespace-pre-wrap text-zinc-300">{line}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
