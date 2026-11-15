"use client";

import { RotateCw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, ApiError } from "@/lib/api";
import { humanize } from "@/lib/format";
import type { Confidence, Insight } from "@/lib/types";

const POLL_MS = 2000;
const MAX_ATTEMPTS = 15; // ~30 s

type Phase = "thinking" | "ready" | "timeout" | "error";

const CONFIDENCE_TONE: Record<Confidence, BadgeTone> = {
  HIGH: "green",
  MEDIUM: "amber",
  LOW: "gray",
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

export function AgentInsightCard({ deploymentId }: { deploymentId: string }) {
  const { insight, phase, message, retry } = useInsight(deploymentId);

  return (
    <Card>
      <section aria-labelledby="agent-heading" aria-busy={phase === "thinking"}>
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-alpha-400 px-6 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <Sparkles className="mt-1 size-4 shrink-0 text-purple-700" aria-hidden />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 id="agent-heading" className="text-heading-16 text-gray-1000">
                  Forge Agent
                </h2>
                <Badge tone="purple" size="sm">
                  AI
                </Badge>
              </div>
              <p className="mt-0.5 text-copy-14 text-gray-900">
                {phase === "thinking" ? (
                  "Reading the logs and the failure…"
                ) : phase === "ready" && insight ? (
                  <>
                    Root cause analysis · engine <span className="font-mono text-label-13 text-gray-1000">{insight.engine}</span>
                  </>
                ) : (
                  "No diagnosis available"
                )}
              </p>
            </div>
          </div>
          {insight && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="gray" className="font-mono">
                {insight.category}
              </Badge>
              <Badge tone={CONFIDENCE_TONE[insight.confidence]}>{humanize(insight.confidence)} confidence</Badge>
            </div>
          )}
        </header>

        <div className="px-6 py-5">
          {phase === "thinking" && (
            <div className="space-y-3" role="status">
              <p className="flex items-center gap-2 text-label-14 text-gray-900">
                <span className="size-2 animate-pulse rounded-full bg-purple-700" aria-hidden />
                Analysing
              </p>
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="mt-4 h-16 w-full" />
            </div>
          )}

          {(phase === "timeout" || phase === "error") && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-copy-14 text-gray-900">
                {phase === "timeout"
                  ? "The agent hasn't posted a diagnosis yet. It may still be working, or the agent is disabled on this server."
                  : message}
              </p>
              <Button size="sm" onClick={retry} icon={<RotateCw className="size-4" aria-hidden />}>
                Check again
              </Button>
            </div>
          )}

          {phase === "ready" && insight && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-4">
                <div>
                  <h3 className="mb-1 text-label-13 font-medium text-gray-900">What happened</h3>
                  <p className="text-copy-14 text-gray-1000">{insight.summary}</p>
                </div>
                <div>
                  <h3 className="mb-1.5 text-label-13 font-medium text-gray-900">Suggested fix</h3>
                  <div className="rounded-md border border-gray-alpha-400 bg-background-200 px-3 py-2.5">
                    <p className="font-mono text-label-13 leading-5 whitespace-pre-wrap text-gray-1000">{insight.suggestedFix}</p>
                  </div>
                </div>
              </div>
              <div className="min-w-0">
                <h3 className="mb-1.5 text-label-13 font-medium text-gray-900">
                  Evidence <span className="tabular">({insight.evidence.length})</span>
                </h3>
                {insight.evidence.length === 0 ? (
                  <p className="text-copy-14 text-gray-900">The agent didn&apos;t cite specific log lines.</p>
                ) : (
                  <ol className="scrollbar-thin max-h-64 overflow-auto rounded-md border border-gray-alpha-400 bg-background-200 py-1.5 font-mono text-label-13 leading-5">
                    {insight.evidence.map((line, i) => (
                      <li key={i} className="flex gap-3 px-3 py-0.5">
                        <span className="w-4 shrink-0 text-right text-gray-700 select-none">{i + 1}</span>
                        <span className="min-w-0 break-words whitespace-pre-wrap text-gray-1000">{line}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </Card>
  );
}
