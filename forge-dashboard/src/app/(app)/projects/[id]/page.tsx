"use client";

import { ArrowLeft, ArrowUpRight, GitBranch, History, KeyRound, Rocket, Settings, SquareTerminal } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
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

type TabId = "deployments" | "environment" | "logs" | "settings";

const TABS: TabDef<TabId>[] = [
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
  const tab: TabId = isTab(tabParam) ? tabParam : "deployments";

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
    router.replace(next === "deployments" ? pathname : `${pathname}?tab=${next}`, { scroll: false });
  };

  const p = project.data;

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

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/projects" className="inline-flex items-center gap-1 text-[13px] text-zinc-500 hover:text-zinc-200">
            <ArrowLeft className="size-3.5" aria-hidden /> Projects
          </Link>
        }
        title={p.name}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <a
              href={`${p.repoUrl}/tree/${encodeURIComponent(p.branch)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-zinc-100"
            >
              <GithubIcon className="size-3.5" />
              {p.repoOwner}/{p.repoName}
              <GitBranch className="ml-1 size-3.5 text-zinc-500" aria-hidden />
              <span className="font-mono text-xs">{p.branch}</span>
            </a>
            {isLive ? (
              <a
                href={p.liveUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 hover:underline"
              >
                {p.liveUrl.replace(/^https?:\/\//, "")}
                <ArrowUpRight className="size-3.5" aria-hidden />
              </a>
            ) : (
              <span className="text-zinc-600">Not live yet</span>
            )}
          </span>
        }
        actions={
          <Button variant="primary" onClick={deploy} loading={deploying} icon={<Rocket className="size-4" aria-hidden />}>
            Deploy
          </Button>
        }
      />

      <Tabs tabs={TABS} value={tab} onChange={setTab} label="Project sections" />

      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="pt-6">
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
