import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  GitBranch,
  HeartPulse,
  KeyRound,
  Layers,
  RotateCcw,
  ScrollText,
  Sparkles,
  Webhook,
} from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { PipelineHero } from "@/components/site/PipelineHero";
import { GITHUB_URL } from "@/components/site/links";
import { GithubIcon } from "@/components/ui/GithubIcon";

export const metadata: Metadata = {
  title: { absolute: "Forge — push code, get a live URL" },
  description:
    "Forge builds, containerizes and deploys apps from Git with blue-green and canary rollouts, automatic rollback, self-healing and an agent that explains failed deploys.",
};

const RESULTS = [
  { value: "0", unit: "errors", label: "during a zero-downtime swap, 583 requests" },
  { value: "927", unit: "requests", label: "canary 20 → 50 → 100%, 0 errors" },
  { value: "4", unit: "s", label: "one-click rollback, no rebuild" },
  { value: "12", unit: "s", label: "self-healing after a live container is deleted" },
  { value: "131", unit: "tests", label: "unit, integration and architecture" },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brand-400">{children}</p>;
}

function DiagnosisCard() {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-ink-900 shadow-2xl shadow-black/40">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-brand-400" aria-hidden />
          <span className="text-[13px] font-medium text-zinc-100">Forge Agent</span>
        </div>
        <span className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 font-mono text-[10px] text-red-300">
          FAILED · UNHEALTHY
        </span>
      </div>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-brand-500/15 px-2 py-0.5 font-mono text-[11px] text-brand-300">PORT_MISMATCH</span>
          <span className="font-mono text-[11px] text-zinc-500">confidence HIGH · engine rules</span>
        </div>
        <p className="text-[14px] leading-relaxed text-zinc-200">
          The app listens on port 3000 but the project expects port 8080, so health checks could not reach it.
        </p>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Evidence</p>
          <pre className="mt-1.5 overflow-x-auto rounded-md bg-black/40 px-3 py-2 font-mono text-[12px] text-zinc-300">
            <span className="text-zinc-600">runtime │ </span>Server listening on port 3000
          </pre>
        </div>
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/[0.06] p-3">
          <p className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">Suggested fix</p>
          <p className="mt-1 text-[13px] leading-relaxed text-zinc-300">
            Either change the project&apos;s port to 3000 in Settings, or make the app read the PORT environment variable (Forge
            sets PORT=8080).
          </p>
        </div>
        <p className="text-[12px] text-zinc-500">The previous version kept serving the whole time.</p>
      </div>
    </div>
  );
}

const RULES = [
  "SOURCE_UNAVAILABLE",
  "UNSUPPORTED_PROJECT",
  "BUILD_TIMEOUT",
  "PLATFORM_ERROR",
  "OUT_OF_MEMORY",
  "MISSING_START_SCRIPT",
  "DEPENDENCY_RESOLUTION",
  "COMPILATION_ERROR",
  "PORT_MISMATCH",
  "HEALTH_PATH_NOT_FOUND",
  "MISSING_CONFIGURATION",
  "CRASH_ON_STARTUP",
  "CANARY_REGRESSION",
];

const SMALL_FEATURES = [
  {
    icon: HeartPulse,
    title: "Self-healing",
    body: "Every 30 s a watcher checks that each live app is still running. If a container is gone, Forge redeploys the same image through the normal health-checked rollout. No rebuild.",
  },
  {
    icon: ScrollText,
    title: "Live logs over SSE",
    body: "Build and runtime output streams to the browser as it happens. Reconnects resume from Last-Event-ID, so no line is lost.",
  },
  {
    icon: KeyRound,
    title: "Encrypted env vars",
    body: "AES-256-GCM at rest with a random IV and tamper detection. Masked in every API response, decrypted only when a container starts.",
  },
  {
    icon: Webhook,
    title: "Deploy on git push",
    body: "GitHub push webhooks are checked with HMAC-SHA256 in constant time and de-duplicated by delivery id before a deploy is queued.",
  },
  {
    icon: Layers,
    title: "Replicas",
    body: "Run 1 to 3 replicas per project. Traefik balances across them; when one dies, the others keep serving while Forge recovers the set.",
  },
  {
    icon: RotateCcw,
    title: "One-click rollback",
    body: "Roll back to any version that went live. The image already exists, so the build is skipped and the swap takes seconds.",
  },
];

const STEPS = [
  { n: "01", title: "Trigger", body: "Click Deploy or push to the branch. The commit is pinned to an exact SHA." },
  { n: "02", title: "Queue", body: "The deployment and its BUILD job are written in one Postgres transaction. The API answers 202 in milliseconds." },
  { n: "03", title: "Build", body: "A worker claims the job with SKIP LOCKED, clones the commit, detects the stack and builds an image." },
  { n: "04", title: "Verify", body: "The new version starts beside the old one in its own VM and must pass its health check." },
  { n: "05", title: "Shift traffic", body: "Blue-green switches at once; canary moves 20% then 50% and compares errors and latency before going to 100%." },
];

const STACK = [
  { name: "Java 21", note: "records, sealed types, virtual threads" },
  { name: "Spring Boot 3.5", note: "Spring Modulith, 11 modules" },
  { name: "PostgreSQL 16", note: "data, logs and the job queue" },
  { name: "Traefik v3", note: "routing and weighted traffic split" },
  { name: "Apple container", note: "one lightweight VM per app; Docker on Linux" },
  { name: "Next.js 16", note: "this dashboard and site" },
];

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="dot-grid ember-edge absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent)]" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:pt-24">
          <div className="site-rise">
            <Eyebrow>Deployment and orchestration platform</Eyebrow>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight text-zinc-50 sm:text-5xl lg:text-[56px]">
              Push code.
              <br />
              Get a live URL.
              <br />
              <span className="text-brand-400">Never a broken one.</span>
            </h1>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-zinc-400">
              Forge builds your repository into a container, rolls it out with blue-green or canary traffic, and rolls back on its own
              when the new version is worse.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className={buttonClass("primary", "md")}>
                Try the demo <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link href="/docs" className={buttonClass("secondary", "md")}>
                <BookOpen className="size-4" aria-hidden /> Read the docs
              </Link>
            </div>
          </div>
          <div className="site-rise" style={{ animationDelay: "150ms" }}>
            <PipelineHero />
          </div>
        </div>
      </section>

      {/* Results */}
      <section aria-labelledby="results-h" className="border-b border-white/[0.06] bg-ink-900/40">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <h2 id="results-h" className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            Measured on real deploys
          </h2>
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-5">
            {RESULTS.map((r) => (
              <div key={r.label}>
                <dt className="sr-only">{r.label}</dt>
                <dd>
                  <span className="tabular text-3xl font-semibold tracking-tight text-zinc-50">{r.value}</span>
                  <span className="ml-1 font-mono text-[12px] text-brand-400">{r.unit}</span>
                  <p className="mt-1 text-[12.5px] leading-snug text-zinc-500">{r.label}</p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Rollouts */}
      <section id="features" aria-labelledby="rollouts-h" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <Eyebrow>Rollouts</Eyebrow>
            <h2 id="rollouts-h" className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50">
              Blue-green and canary, with automatic rollback
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-zinc-400">
              The new version starts next to the live one and must pass its health check before it gets any traffic. With canary on,
              it then takes 20%, then 50%, for 15 seconds each, while Forge compares its 5xx rate and latency with the live version
              over the same window.
            </p>
            <ul className="mt-6 space-y-3 text-[14px] text-zinc-300">
              <li className="flex gap-3">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-cyan-400" />
                More than 5 points more errors, or 2× and 200 ms slower: traffic goes back to the live version at once.
              </li>
              <li className="flex gap-3">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-cyan-400" />A release with 30% failing pages was rolled back at 20%;
                visitors saw 3 errors in 574 requests.
              </li>
              <li className="flex gap-3">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-400" />A failed version never replaces a working one.
              </li>
            </ul>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-ink-900 p-5 font-mono text-[12px]">
            <p className="text-zinc-500">deployment timeline</p>
            <ol className="mt-4 space-y-2.5">
              {[
                ["QUEUED", "zinc"],
                ["BUILDING", "brand"],
                ["DEPLOYING", "brand"],
                ["HEALTH_CHECKING", "brand"],
                ["CANARY 20%", "cyan"],
                ["CANARY 50%", "cyan"],
                ["LIVE 100%", "emerald"],
              ].map(([s, c], i) => (
                <li key={s} className="flex items-center gap-3">
                  <span className="tabular w-5 text-zinc-600">{i + 1}</span>
                  <span
                    className={
                      c === "cyan"
                        ? "text-cyan-300"
                        : c === "emerald"
                          ? "text-emerald-300"
                          : c === "brand"
                            ? "text-brand-300"
                            : "text-zinc-400"
                    }
                  >
                    {s}
                  </span>
                  <span className="h-px flex-1 bg-white/[0.06]" />
                </li>
              ))}
            </ol>
            <p className="mt-5 border-t border-white/[0.06] pt-3 text-zinc-500">
              or <span className="text-red-300">FAILED(CANARY_REGRESSION)</span> → live version keeps 100%
            </p>
          </div>
        </div>
      </section>

      {/* Agent */}
      <section aria-labelledby="agent-h" className="border-y border-white/[0.06] bg-ink-900/40">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:items-center">
          <div>
            <Eyebrow>Forge Agent</Eyebrow>
            <h2 id="agent-h" className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50">
              A failed deploy comes with a reason and a fix
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-zinc-400">
              When a deploy fails, the agent collects the logs, the failure detail and the project&apos;s config, redacts every
              secret, and diagnoses the cause. It uses Claude when an API key is set, and 13 built-in rules offline. Any LLM error
              falls back to the rules.
            </p>
            <ul className="mt-6 flex flex-wrap gap-1.5" aria-label="Diagnosis rules">
              {RULES.map((r) => (
                <li key={r} className="rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10.5px] text-zinc-400">
                  {r}
                </li>
              ))}
            </ul>
          </div>
          <DiagnosisCard />
        </div>
      </section>

      {/* Small features */}
      <section aria-labelledby="more-h" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <Eyebrow>Runtime</Eyebrow>
        <h2 id="more-h" className="mt-3 max-w-xl text-3xl font-semibold tracking-tight text-zinc-50">
          The parts you would otherwise script yourself
        </h2>
        <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {SMALL_FEATURES.map((f) => (
            <div key={f.title} className="border-t border-white/[0.08] pt-5">
              <f.icon className="size-5 text-brand-400" aria-hidden />
              <h3 className="mt-3 text-[15px] font-medium text-zinc-100">{f.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" aria-labelledby="how-h" className="scroll-mt-20 border-y border-white/[0.06] bg-ink-900/40">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <Eyebrow>How it works</Eyebrow>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <h2 id="how-h" className="max-w-xl text-3xl font-semibold tracking-tight text-zinc-50">
              From git push to live in five steps
            </h2>
            <Link href="/architecture" className="inline-flex items-center gap-1.5 text-[13px] text-brand-300 hover:text-brand-200">
              See the architecture <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
          <ol className="mt-12 grid gap-6 md:grid-cols-5">
            {STEPS.map((s) => (
              <li key={s.n} className="relative">
                <span className="font-mono text-[12px] text-brand-400">{s.n}</span>
                <h3 className="mt-2 text-[15px] font-medium text-zinc-100">{s.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Stack */}
      <section aria-labelledby="stack-h" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <Eyebrow>Stack</Eyebrow>
        <h2 id="stack-h" className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50">
          Built on boring, proven parts
        </h2>
        <ul className="mt-10 grid grid-cols-1 border-l border-t border-white/[0.06] sm:grid-cols-2 lg:grid-cols-3">
          {STACK.map((s) => (
            <li key={s.name} className="border-b border-r border-white/[0.06] p-5">
              <p className="font-mono text-[14px] text-zinc-100">{s.name}</p>
              <p className="mt-1 text-[13px] text-zinc-500">{s.note}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* CTA */}
      <section aria-labelledby="cta-h" className="relative overflow-hidden border-t border-white/[0.06]">
        <div className="ember-edge absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 py-24 text-center sm:px-6">
          <h2 id="cta-h" className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            Deploy something.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[15px] text-zinc-400">Sign in with the demo account and deploy a sample app.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/login" className={buttonClass("primary", "md")}>
              Try the demo <ArrowRight className="size-4" aria-hidden />
            </Link>
            <a href={GITHUB_URL} className={buttonClass("secondary", "md")}>
              <GithubIcon className="size-4" /> View source
            </a>
          </div>
          <p className="mt-6 inline-flex items-center gap-1.5 font-mono text-[11px] text-zinc-600">
            <GitBranch className="size-3" aria-hidden /> github.com/sshivanshg/forge
          </p>
        </div>
      </section>
    </>
  );
}
