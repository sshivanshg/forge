"use client";

import { FileText, KeyRound, Pencil, Plus, Rocket, Trash2, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, errorMessage } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { useQuery } from "@/lib/hooks";
import type { EnvVar, Project } from "@/lib/types";

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Parses KEY=value lines (with optional `export`, quotes and # comments). */
function parseDotenv(text: string): { vars: Record<string, string>; invalid: string[] } {
  const vars: Record<string, string> = {};
  const invalid: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    const key = line.slice(0, eq).replace(/^export\s+/, "").trim();
    if (eq < 1 || !KEY_RE.test(key)) {
      invalid.push(line);
      continue;
    }
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return { vars, invalid };
}

interface Props {
  project: Project;
  onDeploy: () => void;
  deploying: boolean;
}

export function EnvironmentTab({ project, onDeploy, deploying }: Props) {
  const toast = useToast();
  const env = useQuery(`env:${project.id}`, () => api.env.list(project.id));
  const [needsRedeploy, setNeedsRedeploy] = useState(false);

  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [bulk, setBulk] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<EnvVar | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function save(vars: Record<string, string>, done: () => void) {
    setSaving(true);
    setFormErrors({});
    try {
      await api.env.upsert(project.id, vars);
      const n = Object.keys(vars).length;
      toast.success(n === 1 ? `Saved ${Object.keys(vars)[0]}` : `Saved ${n} variables`, "Redeploy to apply the change.");
      setNeedsRedeploy(true);
      done();
      env.reload();
    } catch (err) {
      if (err instanceof ApiError) setFormErrors(err.fieldErrors);
      toast.error("Couldn't save variables", errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function onAdd(e: FormEvent) {
    e.preventDefault();
    if (mode === "bulk") {
      const { vars, invalid } = parseDotenv(bulk);
      if (invalid.length) {
        setFormErrors({ bulk: `Can't parse: ${invalid.slice(0, 2).join(", ")}${invalid.length > 2 ? "…" : ""}` });
        return;
      }
      if (Object.keys(vars).length === 0) {
        setFormErrors({ bulk: "Paste at least one KEY=value line." });
        return;
      }
      save(vars, () => setBulk(""));
      return;
    }
    const k = key.trim();
    if (!KEY_RE.test(k)) {
      setFormErrors({ key: "Letters, digits and underscores; can't start with a digit." });
      return;
    }
    save({ [k]: value }, () => {
      setKey("");
      setValue("");
    });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.env.remove(project.id, deleteTarget.key);
      env.setData((list) => (list ?? []).filter((v) => v.key !== deleteTarget.key));
      toast.success(`Deleted ${deleteTarget.key}`);
      setNeedsRedeploy(true);
      setDeleteTarget(null);
    } catch (err) {
      toast.error("Couldn't delete variable", errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  const vars = env.data;

  return (
    <div className="space-y-6">
      {needsRedeploy && (
        <Alert
          tone="info"
          title="Redeploy to apply"
          action={
            <Button size="sm" variant="primary" onClick={onDeploy} loading={deploying} icon={<Rocket className="size-3.5" aria-hidden />}>
              Redeploy
            </Button>
          }
        >
          Running containers keep the environment they started with. The next deployment picks up your changes.
        </Alert>
      )}

      <Card>
        <CardHeader
          icon={<KeyRound className="size-4" aria-hidden />}
          title="Environment variables"
          description="Encrypted at rest and injected at runtime. Values are never shown again after saving."
        />

        {env.error && !vars ? (
          <div className="p-5">
            <Alert action={<Button size="sm" onClick={env.reload}>Retry</Button>}>{env.error.message}</Alert>
          </div>
        ) : !vars ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : vars.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-zinc-500">No variables yet. Add your first one below.</p>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {vars.map((v) => (
              <li key={v.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                <code className="min-w-[10rem] font-mono text-[13px] font-medium text-zinc-100">{v.key}</code>
                {editing === v.key ? (
                  <form
                    className="flex min-w-0 flex-1 items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      save({ [v.key]: editValue }, () => setEditing(null));
                    }}
                  >
                    <Input
                      aria-label={`New value for ${v.key}`}
                      className="font-mono"
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder="New value"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <Button type="submit" size="sm" variant="primary" loading={saving}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)} aria-label="Cancel edit">
                      <X className="size-4" />
                    </Button>
                  </form>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-zinc-500">{v.valuePreview}</span>
                    <span className="hidden text-xs text-zinc-600 sm:inline">{relativeTime(v.updatedAt)}</span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Edit ${v.key}`}
                        onClick={() => {
                          setEditing(v.key);
                          setEditValue("");
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" aria-label={`Delete ${v.key}`} onClick={() => setDeleteTarget(v)} className="hover:text-red-400">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={onAdd} className="space-y-4 border-t border-white/[0.06] bg-white/[0.015] p-5" noValidate>
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium text-zinc-300">Add variables</p>
            <button
              type="button"
              onClick={() => {
                setMode((m) => (m === "single" ? "bulk" : "single"));
                setFormErrors({});
              }}
              className="inline-flex items-center gap-1.5 rounded text-xs text-zinc-500 hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-violet-500/70 focus-visible:outline-none"
            >
              <FileText className="size-3.5" aria-hidden />
              {mode === "single" ? "Paste a .env file" : "Add one at a time"}
            </button>
          </div>
          {mode === "single" ? (
            <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-start">
              <Field label="Key" htmlFor="env-key" error={formErrors.key}>
                <Input
                  id="env-key"
                  className="font-mono"
                  value={key}
                  onChange={(e) => setKey(e.target.value.toUpperCase().replace(/\s/g, "_"))}
                  invalid={!!formErrors.key}
                  placeholder="DATABASE_URL"
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
              <Field label="Value" htmlFor="env-value" error={formErrors.vars ?? formErrors.value}>
                <Input
                  id="env-value"
                  className="font-mono"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="postgres://…"
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
              <Button type="submit" variant="primary" className="sm:mt-[26px]" loading={saving} icon={<Plus className="size-4" aria-hidden />}>
                Add
              </Button>
            </div>
          ) : (
            <>
              <Field label=".env contents" htmlFor="env-bulk" error={formErrors.bulk ?? formErrors.vars}>
                <Textarea
                  id="env-bulk"
                  rows={6}
                  className="font-mono text-[13px]"
                  value={bulk}
                  onChange={(e) => setBulk(e.target.value)}
                  invalid={!!formErrors.bulk}
                  placeholder={"# one per line\nSPRING_PROFILES_ACTIVE=prod\nAPI_KEY=…"}
                  spellCheck={false}
                />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" variant="primary" loading={saving} icon={<Plus className="size-4" aria-hidden />}>
                  Save all
                </Button>
              </div>
            </>
          )}
        </form>
      </Card>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        danger
        title={`Delete ${deleteTarget?.key ?? "variable"}?`}
        description="The next deployment starts without it. Running containers aren't affected until then."
        confirmLabel="Delete"
      />
    </div>
  );
}
