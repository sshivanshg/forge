"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
import { shortSha } from "@/lib/format";
import type { Deployment } from "@/lib/types";

interface RollbackDialogProps {
  target: Deployment | null;
  onClose: () => void;
}

/** Confirms a rollback to `target`'s image, then opens the new deployment. */
export function RollbackDialog({ target, onClose }: RollbackDialogProps) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!target) return;
    setBusy(true);
    try {
      const created = await api.deployments.rollback(target.id);
      toast.success("Rollback started", `Redeploying the image from ${shortSha(target.commitSha)}.`);
      onClose();
      router.push(`/deployments/${created.id}`);
    } catch (err) {
      toast.error("Rollback failed", errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConfirmDialog
      open={!!target}
      onClose={onClose}
      onConfirm={confirm}
      loading={busy}
      title="Roll back to this deployment?"
      confirmLabel="Roll back"
      description={
        target && (
          <>
            Forge will redeploy the already-built image of{" "}
            <code className="rounded bg-white/[0.06] px-1 font-mono text-zinc-200">{shortSha(target.commitSha)}</code>
            {target.commitMessage ? ` (“${target.commitMessage}”)` : ""}. No rebuild needed — traffic switches once it passes
            its health check.
          </>
        )
      }
    />
  );
}
