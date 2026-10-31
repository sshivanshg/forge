"use client";

import { cx } from "@/components/ui/cx";
import { MAX_REPLICAS, type RolloutMode } from "@/lib/types";

export interface RunSettingsValues {
  replicas: number;
  rollout: RolloutMode;
}

const ROLLOUT_OPTIONS: { value: RolloutMode; title: string; description: string }[] = [
  {
    value: "BLUE_GREEN",
    title: "Blue-green",
    description: "Start the new version, health-check it, then switch all traffic at once.",
  },
  {
    value: "CANARY",
    title: "Canary",
    description:
      "Shift traffic in steps (20%, 50%, 100%) while comparing errors and latency with the live version. Rolls back on its own if it's worse.",
  },
];

interface Props {
  values: RunSettingsValues;
  onChange: (patch: Partial<RunSettingsValues>) => void;
  idPrefix?: string;
}

/** Replicas and rollout strategy - how the app runs and how new versions replace it. */
export function RunSettingsFields({ values, onChange, idPrefix = "run" }: Props) {
  const replicaOptions = Array.from({ length: MAX_REPLICAS }, (_, i) => i + 1);
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <p id={`${idPrefix}-replicas`} className="text-[13px] font-medium text-zinc-300">
          Replicas
        </p>
        <div
          role="radiogroup"
          aria-labelledby={`${idPrefix}-replicas`}
          className="inline-flex rounded-md border border-white/10 bg-zinc-950/60 p-0.5"
        >
          {replicaOptions.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={values.replicas === n}
              onClick={() => onChange({ replicas: n })}
              className={cx(
                "h-8 w-11 rounded font-mono text-sm tabular-nums transition-colors",
                "focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:outline-none",
                values.replicas === n ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-zinc-100",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500">
          Identical instances behind the load balancer. If one crashes, the others keep serving while Forge replaces it.
        </p>
      </div>

      <fieldset className="space-y-1.5">
        <legend className="mb-1.5 text-[13px] font-medium text-zinc-300">Rollout strategy</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {ROLLOUT_OPTIONS.map((option) => {
            const selected = values.rollout === option.value;
            return (
              <label
                key={option.value}
                className={cx(
                  "relative flex cursor-pointer flex-col gap-1 rounded-lg border p-3.5 transition-colors",
                  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-violet-500/60",
                  selected ? "border-violet-500/60 bg-violet-500/[0.07]" : "border-white/10 hover:border-white/20",
                )}
              >
                <input
                  type="radio"
                  name={`${idPrefix}-rollout`}
                  value={option.value}
                  checked={selected}
                  onChange={() => onChange({ rollout: option.value })}
                  className="sr-only"
                />
                <span className="flex items-center gap-2 text-[13px] font-medium text-zinc-100">
                  <span
                    className={cx(
                      "flex size-3.5 items-center justify-center rounded-full border",
                      selected ? "border-violet-400" : "border-zinc-600",
                    )}
                    aria-hidden
                  >
                    {selected && <span className="size-1.5 rounded-full bg-violet-400" />}
                  </span>
                  {option.title}
                </span>
                <span className="text-xs leading-relaxed text-zinc-500">{option.description}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
