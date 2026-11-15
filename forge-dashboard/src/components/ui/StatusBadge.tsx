import { STATUS_META, TONE_CLASSES } from "@/lib/status";
import type { DeploymentStatus } from "@/lib/types";
import { cx } from "./cx";

export function StatusDot({ status, className }: { status: DeploymentStatus; className?: string }) {
  const meta = STATUS_META[status];
  const tone = TONE_CLASSES[meta.tone];
  return (
    <span className={cx("relative inline-flex size-2.5 shrink-0", className)} aria-hidden>
      {meta.active && <span className={cx("absolute inset-0 animate-ping rounded-full opacity-50", tone.dot)} />}
      <span className={cx("relative inline-flex size-2.5 rounded-full", tone.dot)} />
    </span>
  );
}

/** Vercel-style status: coloured dot + plain label (no pill). */
export function StatusBadge({ status, className }: { status: DeploymentStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span className={cx("inline-flex items-center gap-2 text-label-14 whitespace-nowrap text-gray-1000", className)}>
      <StatusDot status={status} />
      {meta.label}
    </span>
  );
}
