"use client";

import {
  ArrowRight,
  Check,
  ChevronDown,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { cx } from "@/components/ui/cx";
import { api, ApiError, errorMessage } from "@/lib/api";
import { humanize, relativeTime, shortSha } from "@/lib/format";
import type {
  AgentAction,
  AgentActionSource,
  AgentActionStatus,
  AgentActionType,
  AgentSettingsChange,
} from "@/lib/types";

const POLL_MS = 10_000;

type Scope =
  | { projectId: string; deploymentId?: never }
  | { deploymentId: string; projectId?: never };

const STATUS_TONE: Record<AgentActionStatus, BadgeTone> = {
  PROPOSED: "purple",
  APPROVED: "blue",
  EXECUTED: "green",
  REJECTED: "gray",
  FAILED: "red",
  EXPIRED: "gray",
};

const SOURCE_LABEL: Record<AgentActionSource, string> = {
  FAILURE_INVESTIGATION: "Failure investigation",
  HEALTH_WATCH: "Health watch",
  AUTO_CONFIGURE: "Auto-configure",
};

const TYPE_LABEL: Record<AgentActionType, string> = {
  ROLLBACK: "Roll back",
  REDEPLOY: "Redeploy",
  SCALE_OUT: "Scale out",
  UPDATE_SETTINGS: "Update settings",
};

const SETTING_LABEL: Record<keyof AgentSettingsChange, string> = {
  rootDir: "Root directory",
  buildType: "Build type",
  port: "Port",
  healthCheckPath: "Health check path",
  replicas: "Replicas",
};

function settingChanges(
  settings: AgentSettingsChange | null,
): [string, string][] {
  if (!settings) return [];
  return (Object.keys(SETTING_LABEL) as (keyof AgentSettingsChange)[])
    .filter((k) => settings[k] !== null && settings[k] !== undefined)
    .map((k) => [SETTING_LABEL[k], String(settings[k])]);
}

/** One sentence that says exactly what approving will run. */
function describeEffect(a: AgentAction): string {
  const changes = settingChanges(a.settings)
    .map(([label, value]) => `${label.toLowerCase()} → ${value}`)
    .join(", ");
  switch (a.type) {
    case "ROLLBACK":
      return `Forge will roll back to deployment ${shortSha(a.targetDeploymentId)} using its existing image (no rebuild), through the normal health-checked rollout.`;
    case "REDEPLOY":
      return `Forge will queue a new deployment${a.commitSha ? ` of commit ${shortSha(a.commitSha)}` : ""} and run the full build, deploy and health check.`;
    case "SCALE_OUT":
      return `Forge will set ${changes || "replicas"} and roll out a fresh set of instances. The current version keeps serving until they are healthy.`;
    case "UPDATE_SETTINGS":
      return `Forge will change the project's ${changes || "settings"} and then redeploy${a.commitSha ? ` commit ${shortSha(a.commitSha)}` : ""} with them.`;
  }
}

function useAgentActions(scope: Scope) {
  const key = scope.projectId ?? scope.deploymentId;
  const [actions, setActions] = useState<AgentAction[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const p = scope.projectId
      ? api.agent.projectActions(scope.projectId)
      : api.agent.deploymentActions(scope.deploymentId!);
    return p.then(
      (rows) => {
        setActions(rows);
        setError(null);
      },
      (err: unknown) =>
        setError(errorMessage(err, "Couldn't load the agent's proposals")),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    let alive = true;
    const tick = () => alive && load();
    tick();
    const t = window.setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [load]);

  const replace = (updated: AgentAction) =>
    setActions(
      (rows) => rows?.map((r) => (r.id === updated.id ? updated : r)) ?? null,
    );

  return { actions, error, replace, reload: load };
}

function Proposal({
  action,
  onDecided,
  onStale,
}: {
  action: AgentAction;
  onDecided: (a: AgentAction) => void;
  onStale: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const changes = settingChanges(action.settings);

  const approve = async () => {
    setBusy("approve");
    try {
      const done = await api.agent.approve(action.id);
      onDecided(done);
      setConfirming(false);
      if (done.status === "EXECUTED") {
        toast.success(
          "Approved",
          done.resultMessage ?? `${TYPE_LABEL[done.type]} started`,
        );
        if (done.resultDeploymentId)
          router.push(`/deployments/${done.resultDeploymentId}`);
      } else if (done.status === "APPROVED") {
        toast.info("Approved", "The agent is running it now.");
      } else {
        toast.error("The action failed", done.resultMessage ?? undefined);
      }
    } catch (err) {
      toast.error("Couldn't approve", errorMessage(err));
      if (err instanceof ApiError && err.status === 409) {
        setConfirming(false);
        onStale();
      }
    } finally {
      setBusy(null);
    }
  };

  const reject = async () => {
    setBusy("reject");
    try {
      onDecided(await api.agent.reject(action.id));
      toast.info("Proposal rejected");
    } catch (err) {
      toast.error("Couldn't reject", errorMessage(err));
      if (err instanceof ApiError && err.status === 409) onStale();
    } finally {
      setBusy(null);
    }
  };

  return (
    <li className="px-6 py-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="purple" size="sm">
          {TYPE_LABEL[action.type]}
        </Badge>
        <span className="text-label-13 text-gray-900">
          {SOURCE_LABEL[action.source]} · {relativeTime(action.createdAt)}
        </span>
      </div>
      <h3 className="mt-2 text-label-14 font-medium text-gray-1000">
        {action.title}
      </h3>
      <p className="mt-1 text-copy-14 text-gray-900">{action.rationale}</p>

      {(changes.length > 0 ||
        action.targetDeploymentId ||
        action.commitSha) && (
        <dl className="mt-3 overflow-hidden rounded-md border border-gray-alpha-400 bg-background-200 font-mono text-label-13">
          {changes.map(([label, value]) => (
            <div
              key={label}
              className="flex items-center gap-3 border-b border-gray-alpha-400 px-3 py-2 last:border-b-0"
            >
              <dt className="w-36 shrink-0 font-sans text-gray-900">{label}</dt>
              <dd className="flex min-w-0 items-center gap-2 text-gray-1000">
                <span className="text-green-700" aria-hidden>
                  +
                </span>
                <span className="truncate">{value}</span>
              </dd>
            </div>
          ))}
          {action.targetDeploymentId && (
            <div className="flex items-center gap-3 border-b border-gray-alpha-400 px-3 py-2 last:border-b-0">
              <dt className="w-36 shrink-0 font-sans text-gray-900">
                Target deployment
              </dt>
              <dd>
                <Link
                  href={`/deployments/${action.targetDeploymentId}`}
                  className="text-blue-700 hover:underline focus-ring rounded-sm"
                >
                  {shortSha(action.targetDeploymentId)}
                </Link>
              </dd>
            </div>
          )}
          {action.commitSha && (
            <div className="flex items-center gap-3 px-3 py-2">
              <dt className="w-36 shrink-0 font-sans text-gray-900">Commit</dt>
              <dd className="text-gray-1000">{shortSha(action.commitSha)}</dd>
            </div>
          )}
        </dl>
      )}

      {action.status === "APPROVED" ? (
        <p
          className="mt-4 flex items-center gap-2 text-label-14 text-gray-900"
          role="status"
        >
          <Loader2
            className="size-4 animate-spin text-purple-700"
            aria-hidden
          />
          Running…
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="sm"
            icon={<Check className="size-4" aria-hidden />}
            onClick={() => setConfirming(true)}
            disabled={busy !== null}
          >
            Approve
          </Button>
          <Button
            size="sm"
            icon={<X className="size-4" aria-hidden />}
            onClick={reject}
            loading={busy === "reject"}
            disabled={busy === "approve"}
          >
            Reject
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        onClose={() => busy === null && setConfirming(false)}
        onConfirm={approve}
        loading={busy === "approve"}
        title={`${TYPE_LABEL[action.type]}?`}
        description={action.title}
        confirmLabel={`Approve and ${TYPE_LABEL[action.type].toLowerCase()}`}
      >
        <p className="text-copy-14 text-gray-1000">{describeEffect(action)}</p>
        <p className="mt-3 text-copy-13 text-gray-900">
          This decision is recorded in the deployment audit trail.
        </p>
      </ConfirmDialog>
    </li>
  );
}

function History({ actions }: { actions: AgentAction[] }) {
  const [open, setOpen] = useState(false);
  if (actions.length === 0) return null;
  return (
    <div className="border-t border-gray-alpha-400">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-6 py-3 text-label-13 text-gray-900 transition-colors hover:bg-gray-alpha-100 hover:text-gray-1000 focus-ring"
      >
        <span>
          History <span className="tabular">({actions.length})</span>
        </span>
        <ChevronDown
          className={cx("size-4 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && (
        <ul className="divide-y divide-gray-alpha-400 border-t border-gray-alpha-400">
          {actions.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-6 py-2.5"
            >
              <Badge
                tone={STATUS_TONE[a.status]}
                size="sm"
                className="w-20 justify-center"
              >
                {humanize(a.status)}
              </Badge>
              <span
                className="min-w-0 flex-1 truncate text-label-13 text-gray-1000"
                title={a.resultMessage ?? a.title}
              >
                {a.title}
              </span>
              <span className="text-label-12 text-gray-900">
                {relativeTime(a.decidedAt ?? a.createdAt)}
              </span>
              {a.resultDeploymentId && (
                <Link
                  href={`/deployments/${a.resultDeploymentId}`}
                  className="inline-flex items-center gap-1 rounded-sm text-label-13 text-blue-700 hover:underline focus-ring"
                >
                  Deployment <ArrowRight className="size-3" aria-hidden />
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The agent's proposed changes (rollback, redeploy, scale-out, settings fixes). The agent only
 * proposes: every action needs the user's explicit approval here before Forge runs it.
 */
export function AgentActionsPanel({
  title = "Forge Agent",
  hideWhenEmpty = false,
  ...scope
}: Scope & { title?: string; hideWhenEmpty?: boolean }) {
  const { actions, error, replace, reload } = useAgentActions(scope as Scope);
  const open = (a: AgentAction) =>
    a.status === "PROPOSED" || a.status === "APPROVED";
  const pending = actions?.filter(open) ?? [];
  const decided = actions?.filter((a) => !open(a)) ?? [];
  const awaiting = pending.filter((a) => a.status === "PROPOSED").length;

  if (hideWhenEmpty && (actions === null || actions.length === 0)) return null;

  return (
    <Card>
      <section
        aria-labelledby={`agent-actions-${scope.projectId ?? scope.deploymentId}`}
      >
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-alpha-400 px-6 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <Sparkles
              className="mt-1 size-4 shrink-0 text-purple-700"
              aria-hidden
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2
                  id={`agent-actions-${scope.projectId ?? scope.deploymentId}`}
                  className="text-heading-16 text-gray-1000"
                >
                  {title}
                </h2>
                <Badge tone="purple" size="sm">
                  AI
                </Badge>
              </div>
              <p className="mt-0.5 text-copy-14 text-gray-900">
                Proposed fixes. Nothing runs until you approve it.
              </p>
            </div>
          </div>
          {awaiting > 0 && (
            <Badge tone="purple" className="tabular">
              {awaiting} awaiting approval
            </Badge>
          )}
        </header>

        {actions === null && !error ? (
          <div className="space-y-3 px-6 py-5" role="status">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : error && actions === null ? (
          <p className="px-6 py-5 text-copy-14 text-gray-900">{error}</p>
        ) : pending.length === 0 ? (
          <p className="px-6 py-5 text-copy-14 text-gray-900">
            No open proposals. The agent watches live health and failed
            deployments, and suggests a fix here when it finds one.
          </p>
        ) : (
          <ul className="divide-y divide-gray-alpha-400">
            {pending.map((a) => (
              <Proposal
                key={a.id}
                action={a}
                onDecided={replace}
                onStale={() => void reload()}
              />
            ))}
          </ul>
        )}

        <History actions={decided} />
      </section>
    </Card>
  );
}
