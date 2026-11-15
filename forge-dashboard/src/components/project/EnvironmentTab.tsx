"use client";

import { Eye, EyeOff, FileText, KeyRound, Pencil, Plus, Rocket, Trash2, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, iconButtonClass } from "@/components/ui/Button";
import { Card, CardFooter, CardHeader } from "@/components/ui/Card";
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
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set());

  const toggleReveal = (k: string) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

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
            <Button size="sm" variant="primary" onClick={onDeploy} loading={deploying} icon={<Rocket className="size-4" aria-hidden />}>
              Redeploy
            </Button>
          }
        >
          Running containers keep the environment they started with. The next deployment picks up your changes.
        </Alert>
      )}

      <form onSubmit={onAdd} noValidate>
        <Card>
          <CardHeader
            title="Environment Variables"
            description="Encrypted at rest and injected at runtime. Values are never shown again after saving."
            actions={
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setMode((m) => (m === "single" ? "bulk" : "single"));
                  setFormErrors({});
                }}
                icon={<FileText className="size-4" aria-hidden />}
              >
                {mode === "single" ? "Paste a .env file" : "Add one at a time"}
              </Button>
            }
          />
          <div className="p-6">
            {mode === "single" ? (
              <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:items-start">
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
              </div>
            ) : (
              <Field label=".env contents" htmlFor="env-bulk" error={formErrors.bulk ?? formErrors.vars}>
                <Textarea
                  id="env-bulk"
                  rows={6}
                  className="font-mono text-label-13"
                  value={bulk}
                  onChange={(e) => setBulk(e.target.value)}
                  invalid={!!formErrors.bulk}
                  placeholder={"# one per line\nSPRING_PROFILES_ACTIVE=prod\nAPI_KEY=…"}
                  spellCheck={false}
                />
              </Field>
            )}
          </div>
          <CardFooter>
            <span>A new deployment is required for changes to take effect.</span>
            <Button type="submit" size="sm" variant="primary" loading={saving} icon={<Plus className="size-4" aria-hidden />}>
              {mode === "single" ? "Add" : "Save all"}
            </Button>
          </CardFooter>
        </Card>
      </form>

      <Card className="overflow-hidden">
        {env.error && !vars ? (
          <div className="p-6">
            <Alert action={<Button size="sm" onClick={env.reload}>Retry</Button>}>{env.error.message}</Alert>
          </div>
        ) : !vars ? (
          <div className="space-y-2 p-6">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : vars.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <KeyRound className="size-4 text-gray-900" aria-hidden />
            <p className="mt-3 text-heading-14 text-gray-1000">No environment variables</p>
            <p className="mt-1 text-copy-14 text-gray-900">Add your first one above.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-alpha-400">
            {vars.map((v) => {
              const shown = revealed.has(v.key);
              return (
                <li
                  key={v.key}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-6 py-3 transition-colors hover:bg-gray-alpha-100 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto]"
                >
                  <div className="min-w-0">
                    <code className="block truncate font-mono text-label-14 font-medium text-gray-1000">{v.key}</code>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge tone="gray" size="sm">
                        Production
                      </Badge>
                      <span className="text-label-12 text-gray-900">Updated {relativeTime(v.updatedAt)}</span>
                    </div>
                  </div>
                  {editing === v.key ? (
                    <form
                      className="col-span-2 flex min-w-0 items-center gap-2"
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
                      <button type="button" className={iconButtonClass} onClick={() => setEditing(null)} aria-label="Cancel edit">
                        <X className="size-4" />
                      </button>
                    </form>
                  ) : (
                    <>
                      <div className="hidden min-w-0 items-center gap-1 md:flex">
                        <span className="truncate font-mono text-label-14 text-gray-900">{shown ? v.valuePreview : "••••••••••••"}</span>
                        <button
                          type="button"
                          className={iconButtonClass}
                          aria-label={shown ? `Hide ${v.key} preview` : `Show ${v.key} preview`}
                          aria-pressed={shown}
                          onClick={() => toggleReveal(v.key)}
                        >
                          {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className={iconButtonClass}
                          aria-label={`Edit ${v.key}`}
                          onClick={() => {
                            setEditing(v.key);
                            setEditValue("");
                          }}
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          className={iconButtonClass}
                          aria-label={`Delete ${v.key}`}
                          onClick={() => setDeleteTarget(v)}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
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
