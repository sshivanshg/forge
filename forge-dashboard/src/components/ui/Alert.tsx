import { AlertTriangle, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";

interface AlertProps {
  tone?: "error" | "info" | "warning";
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Geist "Note": tinted fill, matching border, coloured text. */
const tones = {
  error: { box: "border-red-400 bg-red-100 text-red-900", Icon: XCircle },
  warning: { box: "border-amber-400 bg-amber-100 text-amber-900", Icon: AlertTriangle },
  info: { box: "border-blue-400 bg-blue-100 text-blue-900", Icon: Info },
};

export function Alert({ tone = "error", title, children, action, className }: AlertProps) {
  const { box, Icon } = tones[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("flex items-start gap-3 rounded-md border px-3 py-2.5 text-copy-14", box, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={title ? "mt-0.5" : undefined}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
