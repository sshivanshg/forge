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
  /** Horizontal stepper (default) or Vercel's vertical "Deployment details" rows. */
  layout?: "horizontal" | "vertical";
}

function StepIcon({ state, step }: { state: StepState; step: PipelineStep }) {
  const reached = state === "done" || state === "retired";
  return (
    <span
      className={cx(
        "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full transition-colors duration-500",
        state === "done" && "bg-gray-1000 text-background-100",
        state === "retired" && "border border-gray-alpha-400 bg-gray-100 text-gray-900",
        state === "current" && "step-glow border border-blue-400 bg-background-100 text-blue-700",
        state === "failed" && "bg-red-700 text-white",
        state === "cancelled" && "border border-gray-alpha-400 bg-background-100 text-gray-900",
        state === "pending" && "border border-dashed border-gray-alpha-500 bg-background-100 text-gray-700",
      )}
      style={state === "current" ? ({ "--glow": "var(--ds-blue-400)" } as React.CSSProperties) : undefined}
    >
      {reached ? (
        <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
      ) : state === "current" ? (
        step === "LIVE" ? <Check className="size-3.5" aria-hidden /> : <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : state === "failed" ? (
        <X className="size-3.5" strokeWidth={2.5} aria-hidden />
      ) : state === "cancelled" ? (
        <Ban className="size-3.5" aria-hidden />
      ) : null}
    </span>
  );
}

function labelTone(state: StepState) {
  if (state === "done" || state === "current") return "text-gray-1000";
  if (state === "failed") return "text-red-900";
  return "text-gray-900";
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
  layout = "horizontal",
}: PipelineStepperProps) {
  const states = computeStates(steps, status, stoppedAt);
  const describe = (step: PipelineStep, i: number) => {
    const state = states[i];
    const duration = stepDuration(steps, step, i, enteredAt, state, status, finishedAt);
    let label: string = STEP_LABEL[step];
    if (i === steps.length - 1 && (status === "SUPERSEDED" || status === "STOPPED")) label = STATUS_META[status].label;
    const note =
      state === "failed" ? "Failed" : state === "cancelled" ? "Cancelled" : state === "done" && skipped.includes(step) ? "Skipped" : duration;
    return { state, label, note };
  };

  if (layout === "vertical") {
    return (
      <ol className="divide-y divide-gray-alpha-400" aria-label="Deployment pipeline">
        {steps.map((step, i) => {
          const { state, label, note } = describe(step, i);
          return (
            <li key={step} className="flex h-12 items-center gap-3 px-4" aria-current={state === "current" ? "step" : undefined}>
              <StepIcon state={state} step={step} />
              <span className={cx("min-w-0 flex-1 truncate text-label-14 font-medium", labelTone(state))}>
                {label}
                <span className="sr-only"> — {state === "current" ? "in progress" : state === "pending" ? "not started" : state}</span>
              </span>
              <span className={cx("shrink-0 font-mono text-label-13 tabular", state === "failed" ? "text-red-900" : "text-gray-900")}>{note}</span>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <div className="scrollbar-thin overflow-x-auto">
      <ol className="flex min-w-[560px] items-start" aria-label="Deployment pipeline">
        {steps.map((step, i) => {
          const { state, label, note } = describe(step, i);
          const reached = state === "done" || state === "retired";

          return (
            <li
              key={step}
              className="relative flex min-w-0 flex-1 flex-col items-center px-1 text-center"
              aria-current={state === "current" ? "step" : undefined}
            >
              {i > 0 && (
                <span
                  className={cx(
                    "absolute top-3 right-1/2 h-px w-full -translate-y-1/2",
                    reached || state === "current" || state === "failed" || state === "cancelled" ? "bg-gray-alpha-600" : "bg-gray-alpha-400",
                  )}
                  aria-hidden
                />
              )}
              <StepIcon state={state} step={step} />
              <span
                className={cx("mt-2 max-w-full truncate text-label-13 font-medium", labelTone(state))}
              >
                {label}
                <span className="sr-only"> — {state === "current" ? "in progress" : state === "pending" ? "not started" : state}</span>
              </span>
              <span className={cx("mt-0.5 h-4 font-mono text-label-12 tabular", state === "failed" ? "text-red-900" : "text-gray-900")}>{note}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
