import { cx } from "./cx";

/** The Forge mark: a spark on a solid tile that inverts with the theme. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center justify-center rounded-md bg-gray-1000 text-background-100", className ?? "size-6")}>
      <svg viewBox="0 0 24 24" className="size-[62%]" fill="none" aria-hidden>
        <path d="M13.5 2 6 13h5l-1.5 9L18 10.5h-5.2L13.5 2Z" fill="currentColor" />
      </svg>
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-heading-16 text-gray-1000">Forge</span>
    </span>
  );
}
