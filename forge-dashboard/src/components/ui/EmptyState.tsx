import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-gray-alpha-400 bg-background-100 px-6 py-16 text-center">
      <div className="mb-4 flex size-10 items-center justify-center rounded-md border border-gray-alpha-400 bg-background-200 text-gray-900">
        {icon}
      </div>
      <h3 className="text-heading-16 text-gray-1000">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-copy-14 text-gray-900">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
