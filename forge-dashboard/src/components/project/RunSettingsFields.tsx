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
        <p id={`${idPrefix}-replicas`} className="text-label-13 font-medium text-gray-900">
          Replicas
        </p>
        <div
          role="radiogroup"
          aria-labelledby={`${idPrefix}-replicas`}
          className="inline-flex gap-0.5 rounded-md border border-gray-alpha-400 bg-background-100 p-0.5"
        >
          {replicaOptions.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={values.replicas === n}
              onClick={() => onChange({ replicas: n })}
              className={cx(
                "h-8 w-11 rounded-sm text-label-14 font-medium tabular transition-colors focus-ring",
                values.replicas === n ? "bg-gray-1000 text-background-100" : "text-gray-900 hover:bg-gray-alpha-200 hover:text-gray-1000",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-label-13 text-gray-900">
          Identical instances behind the load balancer. If one crashes, the others keep serving while Forge replaces it.
        </p>
      </div>

      <fieldset className="space-y-1.5">
        <legend className="mb-1.5 text-label-13 font-medium text-gray-900">Rollout strategy</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {ROLLOUT_OPTIONS.map((option) => {
            const selected = values.rollout === option.value;
            return (
              <label
                key={option.value}
                className={cx(
                  "relative flex cursor-pointer flex-col gap-1 rounded-md border bg-background-100 p-4 transition-colors",
                  "has-[:focus-visible]:shadow-[0_0_0_2px_var(--ds-background-100),0_0_0_4px_var(--ds-blue-700)]",
                  selected ? "border-gray-1000" : "border-gray-alpha-400 hover:border-gray-alpha-500 hover:bg-gray-alpha-100",
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
                <span className="flex items-center gap-2 text-label-14 font-medium text-gray-1000">
                  <span
                    className={cx(
                      "flex size-4 items-center justify-center rounded-full border",
                      selected ? "border-gray-1000" : "border-gray-alpha-500",
                    )}
                    aria-hidden
                  >
                    {selected && <span className="size-2 rounded-full bg-gray-1000" />}
                  </span>
                  {option.title}
                </span>
                <span className="text-copy-13 text-gray-900">{option.description}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
