"use client";

import { Ban, Check, Loader2, X } from "lucide-react";
import { cx } from "@/components/ui/cx";
import { formatDuration } from "@/lib/format";
import { STATUS_META } from "@/lib/status";
import { PIPELINE_STEPS, type DeploymentStatus, type PipelineStep } from "@/lib/types";

type StepState = "done" | "current" | "failed" | "cancelled" | "pending" | "retired";

const STEP_LABEL: Record<PipelineStep, string> = {
  QUEUED: "Queued",
  BUILDING: "Build",
  DEPLOYING: "Deploy",
  HEALTH_CHECKING: "Health check",
  LIVE: "Live",
};

/** Ring + glow colour for the step that is running right now. */
const CURRENT_STYLE: Record<PipelineStep, { ring: string; text: string; glow: string }> = {
  QUEUED: { ring: "border-zinc-400 bg-zinc-400/10", text: "text-zinc-200", glow: "rgb(161 161 170 / 0.4)" },
  BUILDING: { ring: "border-sky-400 bg-sky-500/15", text: "text-sky-300", glow: "rgb(56 189 248 / 0.45)" },
  DEPLOYING: { ring: "border-violet-400 bg-violet-500/15", text: "text-violet-300", glow: "rgb(167 139 250 / 0.45)" },
  HEALTH_CHECKING: { ring: "border-amber-400 bg-amber-500/15", text: "text-amber-300", glow: "rgb(251 191 36 / 0.45)" },
  LIVE: { ring: "border-emerald-400 bg-emerald-500/15", text: "text-emerald-300", glow: "rgb(52 211 153 / 0.45)" },
};

interface PipelineStepperProps {
  status: DeploymentStatus;
  /** For FAILED / CANCELLED: the step the deployment was in when it stopped. */
  stoppedAt: PipelineStep | null;
  /** When each status was entered (ISO). Used for per-step durations. */
  enteredAt: Partial<Record<DeploymentStatus, string>>;
  finishedAt: string | null;
}

function computeStates(status: DeploymentStatus, stoppedAt: PipelineStep | null): StepState[] {
  const idxOf = (s: PipelineStep) => PIPELINE_STEPS.indexOf(s);
  switch (status) {
    case "FAILED": {
      const stop = idxOf(stoppedAt ?? "QUEUED");
      return PIPELINE_STEPS.map((_, i) => (i < stop ? "done" : i === stop ? "failed" : "pending"));
    }
    case "CANCELLED": {
      const stop = idxOf(stoppedAt ?? "QUEUED");
      return PIPELINE_STEPS.map((_, i) => (i < stop ? "retired" : i === stop ? "cancelled" : "pending"));
    }
    case "SUPERSEDED":
    case "STOPPED":
      return PIPELINE_STEPS.map(() => "retired");
    case "LIVE":
      return PIPELINE_STEPS.map(() => "done");
    default: {
      const cur = idxOf(status);
      return PIPELINE_STEPS.map((_, i) => (i < cur ? "done" : i === cur ? "current" : "pending"));
    }
  }
}

function stepDuration(
  step: PipelineStep,
  index: number,
  enteredAt: PipelineStepperProps["enteredAt"],
  state: StepState,
  status: DeploymentStatus,
  finishedAt: string | null,
): string {
  if (step === "LIVE" || state === "pending") return "";
  const start = enteredAt[step];
  if (!start) return "";
  let end: string | undefined;
  for (const later of PIPELINE_STEPS.slice(index + 1)) {
    if (enteredAt[later]) {
      end = enteredAt[later];
      break;
    }
  }
  if (!end && state !== "current") end = enteredAt[status] ?? finishedAt ?? undefined;
  const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime();
  return ms >= 0 ? formatDuration(ms) : "";
}

export function PipelineStepper({ status, stoppedAt, enteredAt, finishedAt }: PipelineStepperProps) {
  const states = computeStates(status, stoppedAt);

  return (
    <div className="scrollbar-thin overflow-x-auto">
      <ol className="flex min-w-[560px] items-start" aria-label="Deployment pipeline">
        {PIPELINE_STEPS.map((step, i) => {
          const state = states[i];
          const current = CURRENT_STYLE[step];
          const isLast = i === PIPELINE_STEPS.length - 1;
          const nextState = states[i + 1];
          const duration = stepDuration(step, i, enteredAt, state, status, finishedAt);
          let label: string = STEP_LABEL[step];
          if (isLast && (status === "SUPERSEDED" || status === "STOPPED")) label = STATUS_META[status].label;

          return (
            <li key={step} className="relative flex flex-1 flex-col items-center" aria-current={state === "current" ? "step" : undefined}>
              {!isLast && (
                <div className="absolute top-4 left-[calc(50%+22px)] h-0.5 w-[calc(100%-44px)] overflow-hidden rounded-full bg-white/[0.08]" aria-hidden>
                  {state === "done" && (nextState === "done" || nextState === "current" || nextState === "failed") && (
                    <div className="h-full w-full bg-emerald-500/60" />
                  )}
                  {state === "retired" && <div className="h-full w-full bg-zinc-600" />}
                  {state === "current" && <div className="progress-slide h-full w-2/5 bg-gradient-to-r from-transparent via-white/40 to-transparent" />}
                </div>
              )}
              <div
                className={cx(
                  "relative z-10 flex size-8 items-center justify-center rounded-full border-2 transition-colors duration-300",
                  state === "done" && (step === "LIVE" ? "border-emerald-400 bg-emerald-500 text-zinc-950" : "border-emerald-500/70 bg-emerald-500/15 text-emerald-300"),
                  state === "current" && cx(current.ring, current.text, "step-glow"),
                  state === "failed" && "border-red-500 bg-red-500/15 text-red-300",
                  state === "cancelled" && "border-zinc-500 bg-zinc-500/10 text-zinc-400",
                  state === "retired" && "border-zinc-600 bg-zinc-700/30 text-zinc-400",
                  state === "pending" && "border-white/10 bg-zinc-900 text-zinc-600",
                )}
                style={state === "current" ? ({ "--glow": current.glow } as React.CSSProperties) : undefined}
              >
                {state === "done" || state === "retired" ? (
                  <Check className="size-4" strokeWidth={2.5} aria-hidden />
                ) : state === "current" ? (
                  step === "LIVE" ? <Check className="size-4" aria-hidden /> : <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : state === "failed" ? (
                  <X className="size-4" strokeWidth={2.5} aria-hidden />
                ) : state === "cancelled" ? (
                  <Ban className="size-4" aria-hidden />
                ) : (
                  <span className="size-1.5 rounded-full bg-current" aria-hidden />
                )}
              </div>
              <span
                className={cx(
                  "mt-2.5 text-center text-xs font-medium",
                  state === "current" && current.text,
                  state === "done" && "text-zinc-200",
                  state === "failed" && "text-red-300",
                  (state === "cancelled" || state === "retired") && "text-zinc-400",
                  state === "pending" && "text-zinc-600",
                )}
              >
                {label}
                <span className="sr-only">
                  {" "}
                  — {state === "current" ? "in progress" : state === "pending" ? "not started" : state}
                </span>
              </span>
              <span className="mt-0.5 h-4 font-mono text-[11px] text-zinc-500 tabular-nums">
                {state === "failed" ? "failed" : state === "cancelled" ? "cancelled" : duration}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
