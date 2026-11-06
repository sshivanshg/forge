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
  CANARY: "Canary",
  LIVE: "Live",
};

/** Ring + glow colour for the step that is running right now. */
const CURRENT_STYLE: Record<PipelineStep, { ring: string; text: string; glow: string; cell: string; bar: string }> = {
  QUEUED: { ring: "border-zinc-400 bg-zinc-400/10", text: "text-zinc-200", glow: "rgb(161 161 170 / 0.4)", cell: "border-zinc-400/40", bar: "bg-zinc-400" },
  BUILDING: { ring: "border-sky-400 bg-sky-500/15", text: "text-sky-300", glow: "rgb(56 189 248 / 0.45)", cell: "border-sky-400/40", bar: "bg-sky-400" },
  DEPLOYING: { ring: "border-brand-400 bg-brand-500/15", text: "text-brand-300", glow: "rgb(255 138 61 / 0.45)", cell: "border-brand-400/40", bar: "bg-brand-400" },
  HEALTH_CHECKING: { ring: "border-amber-400 bg-amber-500/15", text: "text-amber-300", glow: "rgb(251 191 36 / 0.45)", cell: "border-amber-400/40", bar: "bg-amber-400" },
  CANARY: { ring: "border-cyan-400 bg-cyan-500/15", text: "text-cyan-300", glow: "rgb(34 211 238 / 0.45)", cell: "border-cyan-400/40", bar: "bg-cyan-400" },
  LIVE: { ring: "border-emerald-400 bg-emerald-500/15", text: "text-emerald-300", glow: "rgb(52 211 153 / 0.45)", cell: "border-emerald-400/40", bar: "bg-emerald-400" },
};

interface PipelineStepperProps {
  status: DeploymentStatus;
  /** For FAILED / CANCELLED: the step the deployment was in when it stopped. */
  stoppedAt: PipelineStep | null;
  /** When each status was entered (ISO). Used for per-step durations. */
  enteredAt: Partial<Record<DeploymentStatus, string>>;
  finishedAt: string | null;
  /** Steps this deployment didn't need, e.g. the build of a rollback (it reuses an image). */
  skipped?: readonly PipelineStep[];
  /** The steps to show; canary rollouts add a CANARY step before LIVE. */
  steps?: readonly PipelineStep[];
}

function computeStates(
  steps: readonly PipelineStep[],
  status: DeploymentStatus,
  stoppedAt: PipelineStep | null,
): StepState[] {
  const idxOf = (s: PipelineStep) => steps.indexOf(s);
  switch (status) {
    case "FAILED": {
      const stop = idxOf(stoppedAt ?? "QUEUED");
      return steps.map((_, i) => (i < stop ? "done" : i === stop ? "failed" : "pending"));
    }
    case "CANCELLED": {
      const stop = idxOf(stoppedAt ?? "QUEUED");
      return steps.map((_, i) => (i < stop ? "retired" : i === stop ? "cancelled" : "pending"));
    }
    case "SUPERSEDED":
    case "STOPPED":
      return steps.map(() => "retired");
    case "LIVE":
      return steps.map(() => "done");
    default: {
      const cur = idxOf(status);
      return steps.map((_, i) => (i < cur ? "done" : i === cur ? "current" : "pending"));
    }
  }
}

function stepDuration(
  steps: readonly PipelineStep[],
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
  for (const later of steps.slice(index + 1)) {
    if (enteredAt[later]) {
      end = enteredAt[later];
      break;
    }
  }
  if (!end && state !== "current") end = enteredAt[status] ?? finishedAt ?? undefined;
  const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime();
  return ms >= 0 ? formatDuration(ms) : "";
}

export function PipelineStepper({
  status,
  stoppedAt,
  enteredAt,
  finishedAt,
  skipped = [],
  steps = PIPELINE_STEPS,
}: PipelineStepperProps) {
  const states = computeStates(steps, status, stoppedAt);

  return (
    <div className="scrollbar-thin overflow-x-auto">
      <ol className="flex min-w-[600px] items-stretch gap-1" aria-label="Deployment pipeline">
        {steps.map((step, i) => {
          const state = states[i];
          const current = CURRENT_STYLE[step];
          const isLast = i === steps.length - 1;
          const duration = stepDuration(steps, step, i, enteredAt, state, status, finishedAt);
          let label: string = STEP_LABEL[step];
          if (isLast && (status === "SUPERSEDED" || status === "STOPPED")) label = STATUS_META[status].label;
          const note =
            state === "failed" ? "failed" : state === "cancelled" ? "cancelled" : state === "done" && skipped.includes(step) ? "skipped" : duration;

          return (
            <li
              key={step}
              className={cx(
                "relative flex min-w-0 flex-1 flex-col gap-2 rounded-md border px-3 pt-2.5 pb-3 transition-colors duration-500",
                state === "done" && "border-white/[0.07] bg-white/[0.02]",
                state === "current" && cx("bg-white/[0.03]", current.cell),
                state === "failed" && "border-red-500/40 bg-red-500/[0.06]",
                (state === "cancelled" || state === "retired") && "border-white/[0.06] bg-transparent",
                state === "pending" && "border-dashed border-white/[0.07] bg-transparent",
              )}
              aria-current={state === "current" ? "step" : undefined}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cx(
                    "flex size-5 shrink-0 items-center justify-center rounded-full",
                    state === "done" && (step === "LIVE" ? "bg-emerald-500 text-ink-950" : "bg-emerald-500/15 text-emerald-300"),
                    state === "current" && cx(current.text, "step-glow"),
                    state === "failed" && "bg-red-500/20 text-red-300",
                    state === "cancelled" && "bg-zinc-500/15 text-zinc-400",
                    state === "retired" && "bg-zinc-700/40 text-zinc-400",
                    state === "pending" && "text-zinc-600",
                  )}
                  style={state === "current" ? ({ "--glow": current.glow } as React.CSSProperties) : undefined}
                >
                  {state === "done" || state === "retired" ? (
                    <Check className="size-3" strokeWidth={3} aria-hidden />
                  ) : state === "current" ? (
                    step === "LIVE" ? <Check className="size-3" aria-hidden /> : <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : state === "failed" ? (
                    <X className="size-3" strokeWidth={3} aria-hidden />
                  ) : state === "cancelled" ? (
                    <Ban className="size-3" aria-hidden />
                  ) : (
                    <span className="size-1.5 rounded-full border border-current" aria-hidden />
                  )}
                </span>
                <span
                  className={cx(
                    "truncate text-[13px] font-medium",
                    state === "current" && current.text,
                    state === "done" && "text-zinc-200",
                    state === "failed" && "text-red-300",
                    (state === "cancelled" || state === "retired") && "text-zinc-400",
                    state === "pending" && "text-zinc-600",
                  )}
                >
                  {label}
                  <span className="sr-only"> — {state === "current" ? "in progress" : state === "pending" ? "not started" : state}</span>
                </span>
                <span className={cx("ml-auto shrink-0 font-mono text-[11px] tabular", state === "failed" ? "text-red-400/80" : "text-zinc-500")}>{note}</span>
              </div>
              <div className="h-[3px] overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
                {state === "done" && <div className={cx("h-full w-full", step === "LIVE" ? "bg-emerald-400" : "bg-emerald-500/60")} />}
                {state === "failed" && <div className="h-full w-full bg-red-500/80" />}
                {state === "retired" && <div className="h-full w-full bg-zinc-600" />}
                {state === "cancelled" && <div className="h-full w-1/2 bg-zinc-500" />}
                {state === "current" && (
                  <div className={cx("progress-slide h-full w-2/5", current.bar)} />
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
