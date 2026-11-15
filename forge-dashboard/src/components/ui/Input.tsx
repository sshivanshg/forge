import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";

/** Geist input: page-coloured, hairline border, blue focus halo. */
const control =
  "block w-full rounded-md border bg-background-100 px-3 text-label-14 text-gray-1000 placeholder:text-gray-700 " +
  "transition-[border-color,box-shadow] duration-150 focus:outline-none " +
  "disabled:cursor-not-allowed disabled:bg-background-200 disabled:text-gray-700";

function borderFor(invalid?: boolean) {
  return invalid
    ? "border-red-700 focus:shadow-[0_0_0_3px_var(--ds-red-400)]"
    : "border-gray-alpha-400 hover:border-gray-alpha-500 focus:border-gray-alpha-600 focus:shadow-[0_0_0_3px_var(--ds-gray-alpha-300)]";
}

type WithInvalid = { invalid?: boolean };

export function Input({ invalid, className, ...rest }: ComponentProps<"input"> & WithInvalid) {
  return <input aria-invalid={invalid || undefined} className={cx(control, "h-9", borderFor(invalid), className)} {...rest} />;
}

const chevron =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238f8f8f' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

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
      <label htmlFor={htmlFor} className="block text-label-13 font-medium text-gray-900">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-label-13 text-red-900" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-label-13 text-gray-900">{hint}</p>
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
        <label htmlFor={id} className="block text-label-14 font-medium text-gray-1000">
          {label}
        </label>
        {description && <p className="mt-0.5 text-copy-13 text-gray-900">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative inline-flex h-5 w-8 shrink-0 items-center rounded-full border transition-colors focus-ring",
          checked ? "border-blue-700 bg-blue-700" : "border-gray-alpha-400 bg-gray-200",
          disabled && "opacity-50",
        )}
      >
        <span
          className={cx(
            "inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-[13px]" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}
