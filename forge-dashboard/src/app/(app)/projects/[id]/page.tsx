"use client";

import { ArrowUpRight, GitBranch, History, KeyRound, LayoutGrid, Layers, Rocket, Settings, Split, SquareTerminal } from "lucide-react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { OverviewTab } from "@/components/project/OverviewTab";
import { useBreadcrumbs } from "@/components/shell/Breadcrumbs";
import { DeploymentsTab } from "@/components/project/DeploymentsTab";
import { EnvironmentTab } from "@/components/project/EnvironmentTab";
import { RuntimeLogsTab } from "@/components/project/RuntimeLogsTab";
import { SettingsTab } from "@/components/project/SettingsTab";
import { Alert } from "@/components/ui/Alert";
import { Button, buttonClass } from "@/components/ui/Button";
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
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-80" />
        <Skeleton className="mt-6 h-12 w-full" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    );
  }

  const isLive = !!p.liveDeploymentId;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-heading-32 text-gray-1000">{p.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-label-14 text-gray-900">
            <span className="inline-flex items-center gap-1.5">
              <GitBranch className="size-4" aria-hidden />
              <span className="font-mono">{p.branch}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Layers className="size-4" aria-hidden />
              <span className="tabular">{p.replicas}×</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Split className="size-4" aria-hidden />
              {p.rollout === "CANARY" ? "Canary" : "Blue-green"}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`${p.repoUrl}/tree/${encodeURIComponent(p.branch)}`}
            target="_blank"
            rel="noreferrer"
            className={buttonClass("secondary", "md")}
          >
            <GithubIcon className="size-4" />
            Repository
          </a>
          {isLive && (
            <a href={p.liveUrl} target="_blank" rel="noreferrer" className={buttonClass("secondary", "md")}>
              Visit
              <ArrowUpRight className="size-4" aria-hidden />
            </a>
          )}
          <Button variant="primary" onClick={deploy} loading={deploying} icon={<Rocket className="size-4" aria-hidden />}>
            Deploy
          </Button>
        </div>
      </div>

      <Tabs tabs={TABS} value={tab} onChange={setTab} label="Project sections" />

      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="pt-8">
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
