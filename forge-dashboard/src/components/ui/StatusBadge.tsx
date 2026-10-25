import { STATUS_META, TONE_CLASSES } from "@/lib/status";
import type { DeploymentStatus } from "@/lib/types";
import { cx } from "./cx";

export function StatusDot({ status, className }: { status: DeploymentStatus; className?: string }) {
  const meta = STATUS_META[status];
  const tone = TONE_CLASSES[meta.tone];
  return (
    <span className={cx("relative inline-flex size-2 shrink-0", className)} aria-hidden>
      {meta.active && <span className={cx("absolute inset-0 animate-ping rounded-full opacity-60", tone.dot)} />}
      <span className={cx("relative inline-flex size-2 rounded-full", tone.dot)} />
    </span>
  );
}

export function StatusBadge({ status, className }: { status: DeploymentStatus; className?: string }) {
  const meta = STATUS_META[status];
  const tone = TONE_CLASSES[meta.tone];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        tone.text,
        tone.bg,
        tone.border,
        className,
      )}
    >
      <StatusDot status={status} />
      {meta.label}
    </span>
  );
}
