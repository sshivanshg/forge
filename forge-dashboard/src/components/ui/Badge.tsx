import type { ComponentProps } from "react";
import { cx } from "./cx";

export type BadgeTone = "gray" | "blue" | "amber" | "green" | "red" | "purple" | "teal";

const tones: Record<BadgeTone, string> = {
  gray: "bg-gray-200 text-gray-1000",
  blue: "bg-blue-200 text-blue-900",
  amber: "bg-amber-200 text-amber-900",
  green: "bg-green-200 text-green-900",
  red: "bg-red-200 text-red-900",
  purple: "bg-purple-200 text-purple-900",
  teal: "bg-teal-200 text-teal-900",
};

/** Geist badge: subtle filled pill. `sm` for dense table cells. */
export function Badge({ tone = "gray", size = "md", className, ...rest }: ComponentProps<"span"> & { tone?: BadgeTone; size?: "sm" | "md" }) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-1 rounded-full font-medium whitespace-nowrap",
        size === "sm" ? "h-5 px-1.5 text-label-11" : "h-6 px-2.5 text-label-12",
        tones[tone],
        className,
      )}
      {...rest}
    />
  );
}
