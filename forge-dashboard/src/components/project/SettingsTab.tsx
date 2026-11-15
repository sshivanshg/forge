"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  BuildSettingsFields,
  validateBuildSettings,
  type BuildSettingsValues,
} from "@/components/project/BuildSettingsFields";
import { RunSettingsFields, type RunSettingsValues } from "@/components/project/RunSettingsFields";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardFooter } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, errorMessage } from "@/lib/api";
import type { Project } from "@/lib/types";

function SettingsSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="space-y-5 border-b border-gray-alpha-400 p-6 last-of-type:border-b-0">
      <div className="space-y-1">
        <h2 className="text-heading-20 text-gray-1000">{title}</h2>
        <p className="text-copy-14 text-gray-900">{description}</p>
      </div>
      {children}
    </section>
  );
}

interface Props {
  project: Project;
  onUpdated: (p: Project) => void;
}

function toValues(p: Project): BuildSettingsValues {
  return {
    rootDir: p.rootDir,
    buildType: p.buildType,
    port: String(p.port),
    healthCheckPath: p.healthCheckPath,
    autoDeploy: p.autoDeploy,
  };
}

function toRun(p: Project): RunSettingsValues {
  return { replicas: p.replicas, rollout: p.rollout };
}

export function SettingsTab({ project, onUpdated }: Props) {
  const toast = useToast();
  const router = useRouter();

  const [name, setName] = useState(project.name);
  const [branch, setBranch] = useState(project.branch);
  const [settings, setSettings] = useState<BuildSettingsValues>(() => toValues(project));
  const [run, setRun] = useState<RunSettingsValues>(() => toRun(project));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const original = toValues(project);
  const dirty =
    name !== project.name ||
    branch !== project.branch ||
    run.replicas !== project.replicas ||
    run.rollout !== project.rollout ||
    (Object.keys(original) as (keyof BuildSettingsValues)[]).some((k) => original[k] !== settings[k]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next = validateBuildSettings(settings);
    if (!name.trim()) next.name = "Name can't be empty.";
    if (!branch.trim()) next.branch = "Branch can't be empty.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      const updated = await api.projects.update(project.id, {
        name: name.trim(),
        branch: branch.trim(),
        rootDir: settings.rootDir.trim() || ".",
        buildType: settings.buildType,
        port: Number(settings.port),
        healthCheckPath: settings.healthCheckPath.trim() || "/",
        autoDeploy: settings.autoDeploy,
        replicas: run.replicas,
        rollout: run.rollout,
      });
      onUpdated(updated);
      setSettings(toValues(updated));
      setRun(toRun(updated));
      toast.success("Settings saved", "They apply from the next deployment.");
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors);
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    setDeleting(true);
    try {
      await api.projects.remove(project.id);
      toast.success(`Deleted ${project.name}`);
      router.replace("/projects");
    } catch (err) {
      toast.error("Couldn't delete project", errorMessage(err));
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSave} noValidate>
        <Card>
          <SettingsSection title="General" description="The project's display name and the branch Forge deploys from.">
            {formError && <Alert>{formError}</Alert>}
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Name" htmlFor="set-name" error={errors.name}>
                <Input id="set-name" value={name} onChange={(e) => setName(e.target.value)} invalid={!!errors.name} />
              </Field>
              <Field label="Branch" htmlFor="set-branch" error={errors.branch} hint="Pushes to this branch trigger auto-deploys.">
                <Input
                  id="set-branch"
                  className="font-mono"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  invalid={!!errors.branch}
                />
              </Field>
            </div>
          </SettingsSection>
          <SettingsSection title="Build and Deployment" description="How Forge builds the image and checks that it is healthy.">
            <BuildSettingsFields
              values={settings}
              onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
              errors={errors}
              idPrefix="set"
            />
          </SettingsSection>
          <SettingsSection title="Scaling and Rollout" description="How many instances run and how new versions replace them.">
            <RunSettingsFields values={run} onChange={(patch) => setRun((r) => ({ ...r, ...patch }))} idPrefix="set" />
          </SettingsSection>
          <CardFooter>
            <span>Changes take effect on the next deployment.</span>
            <div className="flex items-center gap-2">
              {dirty && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setName(project.name);
                    setBranch(project.branch);
                    setSettings(toValues(project));
                    setRun(toRun(project));
                    setErrors({});
                  }}
                >
                  Discard
                </Button>
              )}
              <Button type="submit" size="sm" variant="primary" loading={saving} disabled={!dirty}>
                Save
              </Button>
            </div>
          </CardFooter>
        </Card>
      </form>

      <section className="rounded-lg border border-red-400 bg-background-100" aria-labelledby="danger-heading">
        <div className="space-y-1 p-6">
          <h2 id="danger-heading" className="text-heading-20 text-gray-1000">
            Delete Project
          </h2>
          <p className="text-copy-14 text-gray-900">
            Stops the running app, frees its URL and removes all deployments, logs and variables.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-lg border-t border-red-400 bg-red-100 px-6 py-3">
          <span className="text-copy-14 text-red-900">This action is not reversible. Please be certain.</span>
          <Button size="sm" variant="danger" onClick={() => setDeleteOpen(true)}>
            Delete project
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setConfirmText("");
        }}
        onConfirm={onDelete}
        loading={deleting}
        danger
        confirmDisabled={confirmText !== project.slug}
        title={`Delete ${project.name}?`}
        description="This can't be undone."
        confirmLabel="Delete project"
      >
        <Field
          label={
            <>
              Type <code className="rounded-sm bg-gray-100 px-1 font-mono text-gray-1000">{project.slug}</code> to confirm
            </>
          }
          htmlFor="confirm-slug"
        >
          <Input
            id="confirm-slug"
            className="font-mono"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
      </ConfirmDialog>
    </div>
  );
}
