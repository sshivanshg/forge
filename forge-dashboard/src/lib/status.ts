import type { Deployment, DeploymentStatus, FailureReason, PipelineStep } from "./types";
import { shortSha } from "./format";
import { ALL_PIPELINE_STEPS } from "./types";

export type Tone = "gray" | "blue" | "amber" | "green" | "red" | "purple" | "teal";

export interface StatusMeta {
  label: string;
  tone: Tone;
  /** In-progress states get a pulsing dot. */
  active: boolean;
}

export const STATUS_META: Record<DeploymentStatus, StatusMeta> = {
  QUEUED: { label: "Queued", tone: "gray", active: true },
  BUILDING: { label: "Building", tone: "amber", active: true },
  DEPLOYING: { label: "Deploying", tone: "amber", active: true },
  HEALTH_CHECKING: { label: "Health check", tone: "blue", active: true },
  CANARY: { label: "Canary", tone: "purple", active: true },
  LIVE: { label: "Live", tone: "green", active: false },
  FAILED: { label: "Failed", tone: "red", active: false },
  CANCELLED: { label: "Cancelled", tone: "gray", active: false },
  SUPERSEDED: { label: "Superseded", tone: "gray", active: false },
  STOPPED: { label: "Stopped", tone: "gray", active: false },
};

/** Geist steps: 100 tinted bg, 400 border, 700 solid dot, 900 text. */
export const TONE_CLASSES: Record<Tone, { text: string; bg: string; border: string; dot: string }> = {
  gray: { text: "text-gray-900", bg: "bg-gray-100", border: "border-gray-alpha-400", dot: "bg-gray-700" },
  blue: { text: "text-blue-900", bg: "bg-blue-100", border: "border-blue-400", dot: "bg-blue-700" },
  amber: { text: "text-amber-900", bg: "bg-amber-100", border: "border-amber-400", dot: "bg-amber-700" },
  green: { text: "text-green-900", bg: "bg-green-100", border: "border-green-400", dot: "bg-green-700" },
  red: { text: "text-red-900", bg: "bg-red-100", border: "border-red-400", dot: "bg-red-700" },
  purple: { text: "text-purple-900", bg: "bg-purple-100", border: "border-purple-400", dot: "bg-purple-700" },
  teal: { text: "text-teal-900", bg: "bg-teal-100", border: "border-teal-400", dot: "bg-teal-700" },
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
