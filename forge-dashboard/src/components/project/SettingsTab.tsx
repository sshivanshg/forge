"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  BuildSettingsFields,
  validateBuildSettings,
  type BuildSettingsValues,
} from "@/components/project/BuildSettingsFields";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, errorMessage } from "@/lib/api";
import type { Project } from "@/lib/types";

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

export function SettingsTab({ project, onUpdated }: Props) {
  const toast = useToast();
  const router = useRouter();

  const [name, setName] = useState(project.name);
  const [branch, setBranch] = useState(project.branch);
  const [settings, setSettings] = useState<BuildSettingsValues>(() => toValues(project));
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
      });
      onUpdated(updated);
      setSettings(toValues(updated));
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
          <CardHeader title="General" description="Changes take effect on the next deployment." />
          <div className="space-y-5 p-5">
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
            <div className="border-t border-white/[0.06] pt-5">
              <BuildSettingsFields
                values={settings}
                onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
                errors={errors}
                idPrefix="set"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-5 py-3">
            {dirty && (
              <Button
                variant="ghost"
                onClick={() => {
                  setName(project.name);
                  setBranch(project.branch);
                  setSettings(toValues(project));
                  setErrors({});
                }}
              >
                Discard
              </Button>
            )}
            <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>
              Save changes
            </Button>
          </div>
        </Card>
      </form>

      <Card className="border-red-500/25">
        <CardHeader title={<span className="text-red-300">Danger zone</span>} />
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-[13px] font-medium text-zinc-200">Delete this project</p>
            <p className="mt-0.5 text-[13px] text-zinc-500">
              Stops the running app, frees its URL and removes all deployments, logs and variables.
            </p>
          </div>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            Delete project
          </Button>
        </div>
      </Card>

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
              Type <code className="rounded bg-white/[0.06] px-1 font-mono text-zinc-100">{project.slug}</code> to confirm
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
