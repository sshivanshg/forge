import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";

const control =
  "block w-full rounded-md border bg-zinc-950/60 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 " +
  "transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60 " +
  "disabled:opacity-50";

function borderFor(invalid?: boolean) {
  return invalid ? "border-red-500/60" : "border-white/10 hover:border-white/20";
}

type WithInvalid = { invalid?: boolean };

export function Input({ invalid, className, ...rest }: ComponentProps<"input"> & WithInvalid) {
  return <input aria-invalid={invalid || undefined} className={cx(control, "h-9", borderFor(invalid), className)} {...rest} />;
}

const chevron =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

export function Select({ invalid, className, children, ...rest }: ComponentProps<"select"> & WithInvalid) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cx(
        control,
        "h-9 appearance-none bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat pr-8",
        borderFor(invalid),
        className,
      )}
      style={{ backgroundImage: chevron }}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Textarea({ invalid, className, ...rest }: ComponentProps<"textarea"> & WithInvalid) {
  return <textarea aria-invalid={invalid || undefined} className={cx(control, "py-2", borderFor(invalid), className)} {...rest} />;
}

interface FieldProps {
  label: ReactNode;
  htmlFor: string;
  error?: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, error, hint, className, children }: FieldProps) {
  return (
    <div className={cx("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-zinc-300">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-zinc-500">{hint}</p>
      ) : null}
    </div>
  );
}

interface ToggleProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export function Toggle({ id, checked, onChange, label, description, disabled }: ToggleProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="block text-[13px] font-medium text-zinc-300">
          {label}
        </label>
        {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
          checked ? "bg-violet-600" : "bg-zinc-700",
          disabled && "opacity-50",
        )}
      >
        <span
          className={cx(
            "inline-block size-4 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}
