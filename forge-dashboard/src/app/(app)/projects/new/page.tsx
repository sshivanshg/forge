"use client";

import { ArrowLeft, Check, ChevronDown, Lock, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  BuildSettingsFields,
  DEFAULT_BUILD_SETTINGS,
  validateBuildSettings,
  type BuildSettingsValues,
} from "@/components/project/BuildSettingsFields";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { GithubIcon } from "@/components/ui/GithubIcon";
import { Field, Input, Select } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { cx } from "@/components/ui/cx";
import { api, ApiError, errorMessage } from "@/lib/api";
import { slugify } from "@/lib/format";
import { useQuery } from "@/lib/hooks";
import type { CreateProjectInput, GitHubRepo } from "@/lib/types";

type Source = "github" | "manual";

/** Accepts "owner/name", "github.com/owner/name" or a full https/.git URL. */
function parseRepo(input: string): { owner: string; name: string } | null {
  const cleaned = input
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^(www\.)?github\.com\//, "")
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");
  const [owner, name, ...rest] = cleaned.split("/");
  if (!owner || !name || rest.length > 0) return null;
  return { owner, name };
}

function RepoPicker({
  selected,
  onSelect,
}: {
  selected: GitHubRepo | null;
  onSelect: (repo: GitHubRepo) => void;
}) {
  const repos = useQuery("github-repos", () => api.github.repos());
  const [filter, setFilter] = useState("");
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (repos.data ?? []).filter((r) => !q || r.fullName.toLowerCase().includes(q));
  }, [repos.data, filter]);

  if (repos.error) return <Alert>{repos.error.message}</Alert>;

  return (
    <div className="overflow-hidden rounded-lg border border-white/10">
      <div className="relative border-b border-white/[0.06]">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" aria-hidden />
        <input
          aria-label="Filter repositories"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search your repositories…"
          className="h-10 w-full bg-transparent pr-3 pl-9 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
        />
      </div>
      <div role="listbox" aria-label="Repositories" className="scrollbar-thin max-h-72 overflow-y-auto">
        {repos.loading ? (
          <div className="space-y-2 p-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-zinc-500">No repositories match.</p>
        ) : (
          visible.map((r) => {
            const active = selected?.fullName === r.fullName;
            return (
              <button
                key={r.fullName}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => onSelect(r)}
                className={cx(
                  "flex w-full items-center gap-3 border-b border-white/[0.04] px-4 py-2.5 text-left text-[13px] last:border-0",
                  "focus-visible:bg-white/[0.05] focus-visible:outline-none",
                  active ? "bg-violet-500/10 text-zinc-50" : "text-zinc-300 hover:bg-white/[0.04]",
                )}
              >
                <GithubIcon className="size-4 shrink-0 text-zinc-500" />
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-zinc-500">{r.owner}/</span>
                  {r.name}
                </span>
                {r.isPrivate && <Lock className="size-3.5 text-zinc-500" aria-label="Private" />}
                <span className="hidden font-mono text-xs text-zinc-600 sm:inline">{r.defaultBranch}</span>
                {active && <Check className="size-4 text-violet-400" aria-hidden />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function BranchSelect({
  repo,
  value,
  onChange,
  error,
}: {
  repo: GitHubRepo;
  value: string;
  onChange: (b: string) => void;
  error?: string;
}) {
  const branches = useQuery(`branches:${repo.fullName}`, () => api.github.branches(repo.owner, repo.name));
  const options = branches.data ?? [value];
  return (
    <Field label="Branch" htmlFor="branch" error={error ?? branches.error?.message}>
      <Select id="branch" value={value} onChange={(e) => onChange(e.target.value)} disabled={branches.loading}>
        {(options.includes(value) ? options : [value, ...options]).map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </Select>
    </Field>
  );
}

export default function NewProjectPage() {
  const router = useRouter();
  const toast = useToast();
  const connection = useQuery("github-connection", () => api.github.connection());
  const connected = !!connection.data?.connected;

  const [sourceChoice, setSourceChoice] = useState<Source | null>(null);
  const source: Source = sourceChoice ?? (connected ? "github" : "manual");

  const [repo, setRepo] = useState<GitHubRepo | null>(null);
  const [repoInput, setRepoInput] = useState("");
  const [branch, setBranch] = useState("main");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [slug, setSlug] = useState("");
  const [settings, setSettings] = useState<BuildSettingsValues>(DEFAULT_BUILD_SETTINGS);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const manualRepo = parseRepo(repoInput);
  const target = source === "github" ? (repo ? { owner: repo.owner, name: repo.name } : null) : manualRepo;

  function suggestName(repoName: string) {
    if (!nameTouched) setName(repoName);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next: Record<string, string> = validateBuildSettings(settings);
    if (!target) next.repoOwner = source === "github" ? "Pick a repository." : "Enter a repository as owner/name.";
    if (!name.trim()) next.name = "Give the project a name.";
    if (!branch.trim()) next.branch = "Enter a branch.";
    setErrors(next);
    if (Object.keys(next).length > 0 || !target) {
      if (Object.keys(validateBuildSettings(settings)).length > 0) setShowAdvanced(true);
      return;
    }

    const body: CreateProjectInput = {
      name: name.trim(),
      repoOwner: target.owner,
      repoName: target.name,
      branch: branch.trim(),
      rootDir: settings.rootDir.trim() || ".",
      buildType: settings.buildType,
      port: Number(settings.port),
      healthCheckPath: settings.healthCheckPath.trim() || "/",
      autoDeploy: settings.autoDeploy,
    };
    if (slug.trim()) body.slug = slug.trim();

    setSubmitting(true);
    try {
      const project = await api.projects.create(body);
      toast.success("Project created", `${project.name} is ready to deploy.`);
      router.push(`/projects/${project.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        const fieldsAdvanced = ["rootDir", "buildType", "port", "healthCheckPath"];
        if (Object.keys(err.fieldErrors).some((f) => fieldsAdvanced.includes(f))) setShowAdvanced(true);
      }
      setFormError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow={
          <Link href="/projects" className="inline-flex items-center gap-1 text-[13px] text-zinc-500 hover:text-zinc-200">
            <ArrowLeft className="size-3.5" aria-hidden /> Projects
          </Link>
        }
        title="New project"
        description="Connect a repository. Forge figures out how to build it and gives it a URL."
      />

      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        {formError && <Alert>{formError}</Alert>}

        <Card>
          <CardHeader
            title="Repository"
            description={
              source === "github"
                ? `Pick one of ${connection.data?.login ? `@${connection.data.login}'s` : "your"} repositories.`
                : "Public GitHub repositories work without connecting an account."
            }
            actions={
              connected ? (
                <div className="flex rounded-md border border-white/10 p-0.5 text-xs" role="group" aria-label="Repository source">
                  {(["github", "manual"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={source === s}
                      onClick={() => setSourceChoice(s)}
                      className={cx(
                        "rounded px-2.5 py-1 font-medium focus-visible:ring-2 focus-visible:ring-violet-500/70 focus-visible:outline-none",
                        source === s ? "bg-white/10 text-zinc-100" : "text-zinc-500 hover:text-zinc-300",
                      )}
                    >
                      {s === "github" ? "My repos" : "Enter manually"}
                    </button>
                  ))}
                </div>
              ) : undefined
            }
          />
          <div className="space-y-5 p-5">
            {connection.loading ? (
              <Skeleton className="h-10" />
            ) : source === "github" ? (
              <>
                <RepoPicker
                  selected={repo}
                  onSelect={(r) => {
                    setRepo(r);
                    setBranch(r.defaultBranch);
                    suggestName(r.name);
                  }}
                />
                {errors.repoOwner && <p className="text-xs text-red-400" role="alert">{errors.repoOwner}</p>}
                {repo && <BranchSelect key={repo.fullName} repo={repo} value={branch} onChange={setBranch} error={errors.branch} />}
              </>
            ) : (
              <>
                {!connected && connection.data && (
                  <Alert tone="info">
                    Connect GitHub in{" "}
                    <Link href="/settings" className="underline underline-offset-2 hover:text-white">
                      Settings
                    </Link>{" "}
                    to pick from your repositories (and use private ones).
                  </Alert>
                )}
                <div className="grid gap-5 sm:grid-cols-[1fr_12rem]">
                  <Field
                    label="Repository"
                    htmlFor="repo"
                    error={errors.repoOwner ?? errors.repoName}
                    hint="owner/name or a github.com URL"
                  >
                    <Input
                      id="repo"
                      className="font-mono"
                      value={repoInput}
                      onChange={(e) => {
                        setRepoInput(e.target.value);
                        const parsed = parseRepo(e.target.value);
                        if (parsed) suggestName(parsed.name);
                      }}
                      invalid={!!(errors.repoOwner ?? errors.repoName)}
                      placeholder="spring-projects/spring-petclinic"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </Field>
                  <Field label="Branch" htmlFor="branch" error={errors.branch}>
                    <Input
                      id="branch"
                      className="font-mono"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      invalid={!!errors.branch}
                      placeholder="main"
                    />
                  </Field>
                </div>
              </>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Project" description="How the project shows up in Forge and in its URL." />
          <div className="grid gap-5 p-5 sm:grid-cols-2">
            <Field label="Name" htmlFor="name" error={errors.name}>
              <Input
                id="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameTouched(true);
                }}
                invalid={!!errors.name}
                placeholder="petclinic"
              />
            </Field>
            <Field
              label="Slug (optional)"
              htmlFor="slug"
              error={errors.slug}
              hint={`Used in the URL. Defaults to "${slugify(name) || "derived-from-name"}".`}
            >
              <Input
                id="slug"
                className="font-mono"
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                invalid={!!errors.slug}
                placeholder={slugify(name) || "my-app"}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <button
            type="button"
            aria-expanded={showAdvanced}
            aria-controls="advanced-settings"
            onClick={() => setShowAdvanced((s) => !s)}
            className="flex w-full items-center justify-between rounded-xl px-5 py-4 text-left focus-visible:ring-2 focus-visible:ring-violet-500/70 focus-visible:outline-none"
          >
            <span>
              <span className="block text-sm font-semibold text-zinc-100">Build &amp; runtime</span>
              <span className="mt-0.5 block text-[13px] text-zinc-500">
                {settings.buildType === "AUTO" ? "Auto-detect" : settings.buildType} · port {settings.port || "?"} · health{" "}
                {settings.healthCheckPath || "/"} · auto-deploy {settings.autoDeploy ? "on" : "off"}
              </span>
            </span>
            <ChevronDown className={cx("size-4 text-zinc-500 transition-transform", showAdvanced && "rotate-180")} aria-hidden />
          </button>
          {showAdvanced && (
            <div id="advanced-settings" className="border-t border-white/[0.06] p-5">
              <BuildSettingsFields
                values={settings}
                onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
                errors={errors}
                idPrefix="new"
              />
            </div>
          )}
        </Card>

        <div className="flex justify-end gap-2">
          <ButtonLink href="/projects" variant="ghost">
            Cancel
          </ButtonLink>
          <Button type="submit" variant="primary" loading={submitting}>
            Create project
          </Button>
        </div>
      </form>
    </div>
  );
}
