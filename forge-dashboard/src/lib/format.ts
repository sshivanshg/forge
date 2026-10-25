// Small, dependency-free formatting helpers.

export function shortSha(sha: string | null | undefined): string {
  return sha ? sha.slice(0, 7) : "-------";
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Math.round((Date.now() - then) / 1000);
  const abs = Math.abs(diff);
  const suffix = diff >= 0 ? "ago" : "from now";
  if (abs < 10) return "just now";
  if (abs < 60) return `${abs}s ${suffix}`;
  if (abs < 3600) return `${Math.floor(abs / 60)}m ${suffix}`;
  if (abs < 86400) return `${Math.floor(abs / 3600)}h ${suffix}`;
  if (abs < 86400 * 30) return `${Math.floor(abs / 86400)}d ${suffix}`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** Duration between two instants; while `end` is missing, measures up to now. */
export function durationBetween(start: string | null | undefined, end: string | null | undefined): string {
  if (!start) return "";
  const a = new Date(start).getTime();
  const b = end ? new Date(end).getTime() : Date.now();
  return formatDuration(b - a);
}

export function absoluteTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function clockTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function humanize(constant: string | null | undefined): string {
  if (!constant) return "";
  const s = constant.toLowerCase().replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;

/** Strips terminal colour codes that build tools emit. */
export function stripAnsi(line: string): string {
  return line.replace(ANSI, "");
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}
