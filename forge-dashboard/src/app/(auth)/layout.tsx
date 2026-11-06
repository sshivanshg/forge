import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

const LOG = [
  ["00:00.0", "sys", "deploy 4f2a91c queued · main"],
  ["00:01.2", "build", "detected MAVEN · eclipse-temurin:21"],
  ["00:38.7", "build", "image pushed  forge/api:4f2a91c"],
  ["00:41.0", "deploy", "starting 3 replicas"],
  ["00:44.9", "deploy", "health /actuator/health → 200"],
  ["00:45.1", "canary", "traffic 10% → 50% → 100%"],
  ["00:52.3", "sys", "live  api.forge.localhost"],
];

const TONE: Record<string, string> = {
  sys: "text-amber-400",
  build: "text-sky-400",
  deploy: "text-brand-400",
  canary: "text-cyan-400",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen bg-ink-950 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <Link href="/" className="w-fit rounded-md focus-visible:ring-2 focus-visible:ring-brand-500/70 focus-visible:outline-none" aria-label="Forge home">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
        <p className="text-xs text-zinc-600">Push code. Get a live URL. Let the agent explain what broke.</p>
      </div>

      <aside className="dot-grid relative hidden overflow-hidden border-l border-white/[0.06] bg-ink-900 lg:flex lg:flex-col lg:justify-center lg:px-14" aria-hidden>
        <div className="ember-edge absolute inset-0" />
        <div className="relative">
          <p className="text-[11px] font-medium tracking-[0.18em] text-brand-400 uppercase">Deploy pipeline</p>
          <p className="mt-3 max-w-md text-2xl leading-snug font-semibold tracking-tight text-zinc-100">
            From <span className="font-mono text-brand-300">git push</span> to a health-checked, canary-verified URL.
          </p>
          <div className="mt-8 overflow-hidden rounded-lg border border-white/[0.08] bg-[#09090a] shadow-2xl shadow-black/60">
            <div className="flex items-center justify-between border-b border-white/[0.06] bg-ink-850 px-3 py-2 font-mono text-[11px] text-zinc-500">
              <span>forge · deployment 4f2a91c</span>
              <span className="inline-flex items-center gap-1.5 text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-400" /> live
              </span>
            </div>
            <ol className="py-2 font-mono text-[12px] leading-[1.8]">
              {LOG.map(([t, s, l], i) => (
                <li key={i} className="flex gap-3 px-3">
                  <span className="w-4 text-right text-zinc-700">{i + 1}</span>
                  <span className="text-zinc-600">{t}</span>
                  <span className={`w-12 ${TONE[s]}`}>{s}</span>
                  <span className="text-zinc-300">{l}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </aside>
    </main>
  );
}
