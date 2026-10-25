import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 px-6 py-16 text-center">
      <div className="mb-4 flex size-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-zinc-400">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-[13px] text-zinc-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
