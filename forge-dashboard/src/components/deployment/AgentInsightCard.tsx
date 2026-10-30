"use client";

import { Bot, ChevronRight, RotateCw, Sparkles, Wrench } from "lucide-react";
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

const CONFIDENCE_STYLE: Record<Confidence, string> = {
  HIGH: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  MEDIUM: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  LOW: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
};

const CONFIDENCE_BARS: Record<Confidence, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };

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
  const bars = CONFIDENCE_BARS[level];
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium", CONFIDENCE_STYLE[level])}>
      <span className="flex items-end gap-0.5" aria-hidden>
        {[1, 2, 3].map((b) => (
          <span key={b} className={cx("w-0.5 rounded-full bg-current", b <= bars ? "opacity-100" : "opacity-25")} style={{ height: 4 + b * 2 }} />
        ))}
      </span>
      {humanize(level)} confidence
    </span>
  );
}

export function AgentInsightCard({ deploymentId }: { deploymentId: string }) {
  const { insight, phase, message, retry } = useInsight(deploymentId);
  const [showEvidence, setShowEvidence] = useState(false);

  return (
    <section
      aria-labelledby="agent-heading"
      aria-busy={phase === "thinking"}
      className="relative overflow-hidden rounded-xl border border-violet-500/25 bg-gradient-to-b from-violet-500/[0.08] via-zinc-900/60 to-zinc-900/40"
    >
      <div className="pointer-events-none absolute -top-24 -right-24 size-56 rounded-full bg-violet-600/20 blur-3xl" aria-hidden />

      <header className="relative flex flex-wrap items-center justify-between gap-3 border-b border-violet-500/15 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/30">
            <Bot className="size-4" aria-hidden />
          </span>
          <div>
            <h2 id="agent-heading" className="flex items-center gap-1.5 text-sm font-semibold text-zinc-50">
              Forge Agent diagnosis
              <Sparkles className="size-3.5 text-violet-400" aria-hidden />
            </h2>
            <p className="text-xs text-zinc-500">
              {phase === "thinking"
                ? "Reading the logs and the failure…"
                : phase === "ready"
                  ? "Root cause analysis of this failed deployment"
                  : "No diagnosis available"}
            </p>
          </div>
        </div>
        {insight && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-200">
              {humanize(insight.category)}
            </span>
            <ConfidenceMeter level={insight.confidence} />
          </div>
        )}
      </header>

      <div className="relative px-5 py-5">
        {phase === "thinking" && (
          <div className="space-y-3" role="status">
            <p className="flex items-center gap-2 text-[13px] text-violet-200">
              <span className="flex gap-1" aria-hidden>
                <span className="size-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.3s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.15s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-violet-400" />
              </span>
              Thinking…
            </p>
            <Skeleton className="h-4 w-11/12 bg-violet-400/10" />
            <Skeleton className="h-4 w-4/5 bg-violet-400/10" />
            <Skeleton className="mt-4 h-16 w-full bg-violet-400/10" />
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
          <div className="space-y-5">
            <p className="text-[15px] leading-relaxed text-zinc-100">{insight.summary}</p>

            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
              <p className="mb-1.5 flex items-center gap-2 text-xs font-semibold tracking-wide text-emerald-300 uppercase">
                <Wrench className="size-3.5" aria-hidden />
                Suggested fix
              </p>
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-zinc-200">{insight.suggestedFix}</p>
            </div>

            {insight.evidence.length > 0 && (
              <div>
                <button
                  type="button"
                  aria-expanded={showEvidence}
                  aria-controls="agent-evidence"
                  onClick={() => setShowEvidence((s) => !s)}
                  className="inline-flex items-center gap-1 rounded text-[13px] font-medium text-zinc-400 hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-violet-500/70 focus-visible:outline-none"
                >
                  <ChevronRight className={cx("size-4 transition-transform", showEvidence && "rotate-90")} aria-hidden />
                  Evidence ({insight.evidence.length} {insight.evidence.length === 1 ? "line" : "lines"})
                </button>
                {showEvidence && (
                  <pre
                    id="agent-evidence"
                    className="scrollbar-thin mt-2 max-h-64 overflow-auto rounded-lg border border-white/[0.06] bg-[#0b0b0e] p-3 font-mono text-xs leading-relaxed text-zinc-300"
                  >
                    {insight.evidence.join("\n")}
                  </pre>
                )}
              </div>
            )}

            <p className="text-xs text-zinc-500">
              Engine: <span className="font-mono text-zinc-400">{insight.engine}</span>
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
