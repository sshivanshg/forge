import { HeartPulse, Undo2, User, Webhook } from "lucide-react";
import type { DeploymentTrigger } from "@/lib/types";

const TRIGGERS: Record<DeploymentTrigger, { label: string; Icon: typeof User }> = {
  MANUAL: { label: "Manual", Icon: User },
  WEBHOOK: { label: "Git push", Icon: Webhook },
  ROLLBACK: { label: "Rollback", Icon: Undo2 },
  RECOVERY: { label: "Auto-recovery", Icon: HeartPulse },
};

export function TriggerIcon({ trigger, className = "size-3.5" }: { trigger: DeploymentTrigger; className?: string }) {
  const { label, Icon } = TRIGGERS[trigger];
  return <Icon className={className} aria-label={label} role="img" />;
}

export function TriggerLabel({ trigger }: { trigger: DeploymentTrigger }) {
  const { label, Icon } = TRIGGERS[trigger];
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-3.5 text-zinc-500" aria-hidden />
      {label}
    </span>
  );
}
