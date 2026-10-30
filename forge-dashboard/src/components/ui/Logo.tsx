import { cx } from "./cx";

/** The Forge mark: a spark struck off an anvil. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-900/40 ring-1 ring-white/20",
        className ?? "size-7",
      )}
    >
      <svg viewBox="0 0 24 24" className="size-[60%]" fill="none" aria-hidden>
        <path d="M13.5 2 6 13h5l-1.5 9L18 10.5h-5.2L13.5 2Z" fill="white" />
      </svg>
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-tight text-zinc-50">Forge</span>
    </span>
  );
}
