// Dashboard aggregates. Each prefers the server endpoint and falls back to computing the same
// shape client-side, so the UI keeps working against a forge-server without those endpoints.

import { api, ApiError } from "./api";
import type { ActivityItem, Deployment, DeploysByDay, Overview, Project } from "./types";

const DAY = 86_400_000;

function missing(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 404 || err.status === 405 || err.status === 501);
}

export function isSucceeded(d: Pick<Deployment, "status">): boolean {
  return d.status === "LIVE" || d.status === "SUPERSEDED" || d.status === "STOPPED";
}

/** Wall-clock time of a finished deployment, or null while it runs. */
export function deployDurationMs(d: Pick<Deployment, "createdAt" | "startedAt" | "finishedAt">): number | null {
  if (!d.finishedAt) return null;
  const start = new Date(d.startedAt ?? d.createdAt).getTime();
  const ms = new Date(d.finishedAt).getTime() - start;
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

async function allProjects(): Promise<Project[]> {
  return (await api.projects.list(0, 100)).content;
}

async function recentAcrossProjects(projects: Project[], perProject: number): Promise<ActivityItem[]> {
  const pages = await Promise.all(
    projects.map((p) =>
      api.deployments.list(p.id, 0, perProject).then(
        (page) => page.content.map((d) => ({ ...d, projectName: p.name, projectSlug: p.slug })),
        () => [] as ActivityItem[],
      ),
    ),
  );
  return pages.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function fetchActivity(limit = 20): Promise<ActivityItem[]> {
  try {
    return await api.activity(limit);
  } catch (err) {
    if (!missing(err)) throw err;
  }
  return (await recentAcrossProjects(await allProjects(), limit)).slice(0, limit);
}

export function buildDays(items: Pick<Deployment, "createdAt" | "status">[], days = 14): DeploysByDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: DeploysByDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY);
    out.push({ date: d.toISOString().slice(0, 10), succeeded: 0, failed: 0 });
  }
  const start = today.getTime() - (days - 1) * DAY;
  for (const it of items) {
    const t = new Date(it.createdAt);
    t.setHours(0, 0, 0, 0);
    const idx = Math.round((t.getTime() - start) / DAY);
    if (idx < 0 || idx >= days) continue;
    if (it.status === "FAILED") out[idx].failed++;
    else if (isSucceeded(it)) out[idx].succeeded++;
  }
  return out;
}

export async function fetchOverview(): Promise<Overview> {
  try {
    return await api.overview();
  } catch (err) {
    if (!missing(err)) throw err;
  }
  const projects = await allProjects();
  const recent = await recentAcrossProjects(projects, 50);
  const since = Date.now() - 7 * DAY;
  const week = recent.filter((d) => new Date(d.createdAt).getTime() >= since);
  const finished = week.filter((d) => d.status === "FAILED" || isSucceeded(d));
  const ok = finished.filter(isSucceeded);
  return {
    projects: projects.length,
    liveProjects: projects.filter((p) => p.liveDeploymentId).length,
    deploys7d: week.length,
    failed7d: week.filter((d) => d.status === "FAILED").length,
    successRate7d: finished.length ? ok.length / finished.length : null,
    medianDeployMs7d: median(ok.map(deployDurationMs).filter((v): v is number => v !== null)),
    deploysByDay: buildDays(recent, 14),
  };
}
