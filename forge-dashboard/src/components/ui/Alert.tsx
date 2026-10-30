import { AlertTriangle, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";

interface AlertProps {
  tone?: "error" | "info" | "warning";
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

const tones = {
  error: "border-red-500/25 bg-red-500/[0.07] text-red-200",
  warning: "border-amber-500/25 bg-amber-500/[0.07] text-amber-100",
  info: "border-violet-500/25 bg-violet-500/[0.07] text-violet-100",
};

export function Alert({ tone = "error", title, children, action, className }: AlertProps) {
  const Icon = tone === "info" ? Info : AlertTriangle;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cx("flex items-start gap-3 rounded-lg border px-4 py-3 text-[13px]", tones[tone], className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0 opacity-80" aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cx("opacity-80", title ? "mt-0.5" : undefined)}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
