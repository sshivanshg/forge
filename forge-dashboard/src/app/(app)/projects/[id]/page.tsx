"use client";

import { ArrowUpRight, Copy, GitBranch, History, KeyRound, LayoutGrid, Layers, Rocket, Settings, Split, SquareTerminal } from "lucide-react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { OverviewTab } from "@/components/project/OverviewTab";
import { useBreadcrumbs } from "@/components/shell/Breadcrumbs";
import { DeploymentsTab } from "@/components/project/DeploymentsTab";
import { EnvironmentTab } from "@/components/project/EnvironmentTab";
import { RuntimeLogsTab } from "@/components/project/RuntimeLogsTab";
import { SettingsTab } from "@/components/project/SettingsTab";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { GithubIcon } from "@/components/ui/GithubIcon";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
import { useQuery } from "@/lib/hooks";

type TabId = "overview" | "deployments" | "environment" | "logs" | "settings";

const TABS: TabDef<TabId>[] = [
  { id: "overview", label: "Overview", icon: <LayoutGrid className="size-4" aria-hidden /> },
  { id: "deployments", label: "Deployments", icon: <History className="size-4" aria-hidden /> },
  { id: "environment", label: "Environment", icon: <KeyRound className="size-4" aria-hidden /> },
  { id: "logs", label: "Runtime logs", icon: <SquareTerminal className="size-4" aria-hidden /> },
  { id: "settings", label: "Settings", icon: <Settings className="size-4" aria-hidden /> },
];

function isTab(v: string | null): v is TabId {
  return TABS.some((t) => t.id === v);
}

function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const tabParam = params.get("tab");
  const tab: TabId = isTab(tabParam) ? tabParam : "overview";

  const project = useQuery(`project:${id}`, () => api.projects.get(id));
  const [deploying, setDeploying] = useState(false);

  async function deploy() {
    setDeploying(true);
    try {
      const d = await api.deployments.create(id);
      router.push(`/deployments/${d.id}`);
    } catch (err) {
      toast.error("Couldn't start a deployment", errorMessage(err));
      setDeploying(false);
    }
  }

  const setTab = (next: TabId) => {
    router.replace(next === "overview" ? pathname : `${pathname}?tab=${next}`, { scroll: false });
  };

  const p = project.data;
  useBreadcrumbs([{ label: "Projects", href: "/projects" }, { label: p?.name ?? "…" }], `project:${p?.name}`);

  if (project.error && !p) {
    return (
      <Alert action={<Button size="sm" onClick={project.reload}>Retry</Button>}>
        {project.error.status === 404 ? "This project doesn't exist or isn't yours." : project.error.message}
      </Alert>
    );
  }

  if (!p) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
        <Skeleton className="mt-8 h-10 w-full" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const isLive = !!p.liveDeploymentId;
  const host = p.liveUrl.replace(/^https?:\/\//, "");

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="hidden size-12 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-ink-800 font-mono text-lg font-semibold text-zinc-200 sm:flex">
            {p.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="truncate text-xl font-semibold tracking-tight text-zinc-50 sm:text-[22px]">{p.name}</h1>
              {isLive ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300">
                  <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden /> Live
                </span>
              ) : (
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-zinc-500">Not live</span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-zinc-400">
              {isLive ? (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <a href={p.liveUrl} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 font-mono text-xs text-emerald-400 hover:text-emerald-300 hover:underline">
                    <span className="truncate">{host}</span>
                    <ArrowUpRight className="size-3.5 shrink-0" aria-hidden />
                  </a>
                  <button
                    type="button"
                    aria-label="Copy live URL"
                    onClick={() => navigator.clipboard?.writeText(p.liveUrl).then(() => toast.success("Copied live URL"))}
                    className="rounded p-1 text-zinc-600 hover:text-zinc-300 focus-visible:ring-2 focus-visible:ring-brand-500/70 focus-visible:outline-none"
                  >
                    <Copy className="size-3" />
                  </button>
                </span>
              ) : (
                <span className="font-mono text-xs text-zinc-600">{host}</span>
              )}
              <a
                href={`${p.repoUrl}/tree/${encodeURIComponent(p.branch)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-zinc-100"
              >
                <GithubIcon className="size-3.5" />
                {p.repoOwner}/{p.repoName}
              </a>
              <span className="inline-flex items-center gap-1 font-mono text-xs">
                <GitBranch className="size-3.5 text-zinc-500" aria-hidden />
                {p.branch}
              </span>
              <span className="inline-flex items-center gap-1 text-xs">
                <Layers className="size-3.5 text-zinc-500" aria-hidden />
                <span className="font-mono">{p.replicas}×</span>
              </span>
              <span className={`inline-flex items-center gap-1 text-xs ${p.rollout === "CANARY" ? "text-cyan-300" : ""}`}>
                <Split className="size-3.5" aria-hidden />
                {p.rollout === "CANARY" ? "Canary" : "Blue-green"}
              </span>
            </div>
          </div>
        </div>
        <Button variant="primary" onClick={deploy} loading={deploying} icon={<Rocket className="size-4" aria-hidden />}>
          Deploy
        </Button>
      </div>

      <Tabs tabs={TABS} value={tab} onChange={setTab} label="Project sections" />

      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="pt-6">
        {tab === "overview" && <OverviewTab key={p.id} project={p} />}
        {tab === "deployments" && <DeploymentsTab project={p} onDeploy={deploy} deploying={deploying} />}
        {tab === "environment" && <EnvironmentTab project={p} onDeploy={deploy} deploying={deploying} />}
        {tab === "logs" && <RuntimeLogsTab key={p.id} project={p} />}
        {tab === "settings" && <SettingsTab key={p.updatedAt} project={p} onUpdated={(u) => project.setData(u)} />}
      </div>
    </>
  );
}

export default function ProjectPage() {
  return (
    <Suspense>
      <ProjectView />
    </Suspense>
  );
}
