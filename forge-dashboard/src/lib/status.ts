import type { Deployment, DeploymentStatus, FailureReason, PipelineStep } from "./types";
import { shortSha } from "./format";
import { ALL_PIPELINE_STEPS } from "./types";

export type Tone = "blue" | "violet" | "amber" | "cyan" | "green" | "red" | "grey" | "slate";

export interface StatusMeta {
  label: string;
  tone: Tone;
  /** In-progress states get a pulsing dot. */
  active: boolean;
}

export const STATUS_META: Record<DeploymentStatus, StatusMeta> = {
  QUEUED: { label: "Queued", tone: "slate", active: true },
  BUILDING: { label: "Building", tone: "blue", active: true },
  DEPLOYING: { label: "Deploying", tone: "violet", active: true },
  HEALTH_CHECKING: { label: "Health check", tone: "amber", active: true },
  CANARY: { label: "Canary", tone: "cyan", active: true },
  LIVE: { label: "Live", tone: "green", active: false },
  FAILED: { label: "Failed", tone: "red", active: false },
  CANCELLED: { label: "Cancelled", tone: "grey", active: false },
  SUPERSEDED: { label: "Superseded", tone: "grey", active: false },
  STOPPED: { label: "Stopped", tone: "grey", active: false },
};

export const TONE_CLASSES: Record<Tone, { text: string; bg: string; border: string; dot: string }> = {
  blue: { text: "text-sky-300", bg: "bg-sky-500/10", border: "border-sky-500/25", dot: "bg-sky-400" },
  violet: { text: "text-violet-300", bg: "bg-violet-500/10", border: "border-violet-500/25", dot: "bg-violet-400" },
  amber: { text: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/25", dot: "bg-amber-400" },
  cyan: { text: "text-cyan-300", bg: "bg-cyan-500/10", border: "border-cyan-500/25", dot: "bg-cyan-400" },
  green: { text: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/25", dot: "bg-emerald-400" },
  red: { text: "text-red-300", bg: "bg-red-500/10", border: "border-red-500/25", dot: "bg-red-400" },
  grey: { text: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20", dot: "bg-zinc-500" },
  slate: { text: "text-zinc-300", bg: "bg-zinc-400/10", border: "border-zinc-400/20", dot: "bg-zinc-300" },
};

export function isInProgress(status: DeploymentStatus): boolean {
  return STATUS_META[status].active;
}

export function canCancel(status: DeploymentStatus): boolean {
  return status === "QUEUED" || status === "BUILDING";
}

export function canRollback(d: Pick<Deployment, "imageRef" | "status">): boolean {
  return !!d.imageRef && (d.status === "LIVE" || d.status === "SUPERSEDED" || d.status === "STOPPED");
}

/** Did this deployment go (or is it going) through a canary step? */
export function usedCanary(d: Pick<Deployment, "status" | "failureReason" | "timeline">): boolean {
  return (
    d.status === "CANARY" ||
    d.failureReason === "CANARY_REGRESSION" ||
    !!d.timeline?.some((t) => t.to === "CANARY")
  );
}

/** Row title: the commit message, or (before the build has read it) what triggered the deploy. */
export function deploymentTitle(d: Pick<Deployment, "commitMessage" | "trigger" | "commitSha">): string {
  const message = d.commitMessage?.split("\n")[0];
  if (message) return message;
  const sha = shortSha(d.commitSha);
  switch (d.trigger) {
    case "ROLLBACK":
      return `Rollback to ${sha}`;
    case "RECOVERY":
      return `Auto-recovery of ${sha}`;
    case "WEBHOOK":
      return `Push ${sha}`;
    default:
      return `Manual deploy of ${sha}`;
  }
}

export function isPipelineStep(s: string | null | undefined): s is PipelineStep {
  return !!s && (ALL_PIPELINE_STEPS as readonly string[]).includes(s);
}

/** Best guess at the pipeline step a failure happened in, when no timeline is available. */
export function stepForFailure(reason: FailureReason | null): PipelineStep {
  switch (reason) {
    case "SOURCE_UNAVAILABLE":
    case "UNSUPPORTED_PROJECT":
    case "BUILD_FAILED":
    case "BUILD_TIMEOUT":
    case "PUSH_FAILED":
      return "BUILDING";
    case "RUNTIME_ERROR":
      return "DEPLOYING";
    case "UNHEALTHY":
      return "HEALTH_CHECKING";
    case "CANARY_REGRESSION":
      return "CANARY";
    default:
      return "QUEUED";
  }
}

export const FAILURE_LABEL: Record<FailureReason, string> = {
  SOURCE_UNAVAILABLE: "Source unavailable",
  UNSUPPORTED_PROJECT: "Unsupported project",
  BUILD_FAILED: "Build failed",
  BUILD_TIMEOUT: "Build timed out",
  PUSH_FAILED: "Image push failed",
  RUNTIME_ERROR: "Runtime error",
  UNHEALTHY: "Health check failed",
  CANARY_REGRESSION: "Canary rolled back",
  INTERNAL_ERROR: "Internal error",
};
