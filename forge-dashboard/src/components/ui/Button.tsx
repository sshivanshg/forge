import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";

/**
 * Geist button.
 *  primary   — solid gray-1000 (white in dark, black in light). One per view.
 *  secondary — page-coloured with a hairline border.
 *  ghost     — "tertiary": no chrome until hover.
 *  danger    — solid red for destructive confirms.
 */
type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap select-none " +
  "transition-[background-color,color,box-shadow] duration-150 focus-ring " +
  "disabled:pointer-events-none disabled:bg-gray-100 disabled:text-gray-700 disabled:shadow-border";

const variants: Record<Variant, string> = {
  primary: "bg-gray-1000 text-background-100 hover:bg-gray-1000/85",
  secondary: "bg-background-100 text-gray-1000 shadow-border hover:bg-gray-alpha-200",
  ghost: "text-gray-1000 hover:bg-gray-alpha-200",
  danger: "bg-red-700 text-white hover:bg-red-700/85",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-2.5 text-label-14",
  md: "h-10 px-3.5 text-label-14",
  lg: "h-12 px-4 text-copy-16",
};

/** Square ghost icon button for row actions (pair with aria-label). */
export const iconButtonClass =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-gray-900 transition-colors hover:bg-gray-alpha-200 hover:text-gray-1000 focus-ring disabled:pointer-events-none disabled:opacity-50";

export function buttonClass(variant: Variant = "secondary", size: Size = "md", extra?: string) {
  return cx(base, variants[variant], sizes[size], extra);
}

interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({ variant, size, loading, icon, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export function ButtonLink({ variant, size, icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
