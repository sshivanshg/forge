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
import { Badge } from "@/components/ui/Badge";
import { PipelineHero } from "@/components/site/PipelineHero";
import { GITHUB_URL } from "@/components/site/links";
import { GithubIcon } from "@/components/ui/GithubIcon";
import { cx } from "@/components/ui/cx";

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

/** Small section label in quiet label type. */
function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="text-label-13 font-medium text-gray-900">{children}</p>;
}

function SectionHeading({ id, kicker, children, className }: { id: string; kicker: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Kicker>{kicker}</Kicker>
      <h2 id={id} className="mt-3 text-heading-32 text-gray-1000 md:text-heading-40">
        {children}
      </h2>
    </div>
  );
}

function DiagnosisCard() {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-alpha-400 bg-background-100 shadow-menu">
      <div className="flex items-center justify-between border-b border-gray-alpha-400 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-gray-1000" aria-hidden />
          <span className="text-label-14 font-medium text-gray-1000">Forge Agent</span>
        </div>
        <Badge tone="red" size="sm" className="font-mono">
          FAILED · UNHEALTHY
        </Badge>
      </div>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-sm bg-gray-alpha-200 px-1.5 py-0.5 font-mono text-label-12 text-gray-1000">PORT_MISMATCH</span>
          <span className="font-mono text-label-12 text-gray-900">confidence HIGH · engine rules</span>
        </div>
        <p className="text-copy-14 text-gray-1000">
          The app listens on port 3000 but the project expects port 8080, so health checks could not reach it.
        </p>
        <div>
          <p className="text-label-12 font-medium text-gray-900">Evidence</p>
          <pre className="mt-1.5 overflow-x-auto rounded-md border border-gray-alpha-400 bg-background-200 px-3 py-2 font-mono text-label-12 text-gray-1000">
            <span className="text-gray-900">runtime │ </span>Server listening on port 3000
          </pre>
        </div>
        <div className="rounded-md border border-gray-alpha-400 p-3">
          <p className="text-label-12 font-medium text-gray-1000">Suggested fix</p>
          <p className="mt-1 text-copy-13 text-gray-900">
            Either change the project&apos;s port to 3000 in Settings, or make the app read the PORT environment variable (Forge
            sets PORT=8080).
          </p>
        </div>
        <p className="text-copy-13 text-gray-900">The previous version kept serving the whole time.</p>
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

const TIMELINE: [string, "muted" | "default" | "canary" | "live"][] = [
  ["QUEUED", "muted"],
  ["BUILDING", "default"],
  ["DEPLOYING", "default"],
  ["HEALTH_CHECKING", "default"],
  ["CANARY 20%", "canary"],
  ["CANARY 50%", "canary"],
  ["LIVE 100%", "live"],
];

const TIMELINE_TONE = {
  muted: "text-gray-900",
  default: "text-gray-1000",
  canary: "text-blue-900",
  live: "text-green-900",
};

/** Vercel-style framed section: hairline top border inside the bordered page column. */
const frame = "border-t border-gray-alpha-400";

export default function LandingPage() {
  return (
    <div className="mx-auto max-w-[1200px] border-gray-alpha-400 min-[1200px]:border-x">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="grid-backdrop absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]"
          aria-hidden
        />
        <div className="relative px-4 pb-16 pt-20 text-center sm:px-6 md:pb-20 md:pt-28">
          <div className="site-rise">
            <Badge tone="gray">Deployment and orchestration platform</Badge>
            <h1 className="mx-auto mt-6 max-w-4xl text-heading-48 text-gray-1000 md:text-heading-72">
              Push code. Get a live URL.
              <br />
              <span className="text-gray-900">Never a broken one.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-copy-16 text-gray-900 md:text-copy-20">
              Forge builds your repository into a container, rolls it out with blue-green or canary traffic, and rolls back on its own
              when the new version is worse.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link href="/login" className={buttonClass("primary", "lg")}>
                Try the demo <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link href="/docs" className={buttonClass("secondary", "lg")}>
                <BookOpen className="size-4" aria-hidden /> Read the docs
              </Link>
            </div>
          </div>
          <div className="site-rise mx-auto mt-16 max-w-3xl" style={{ animationDelay: "150ms" }}>
            <PipelineHero />
          </div>
        </div>
      </section>

      {/* Results */}
      <section aria-labelledby="results-h" className={frame}>
        <h2 id="results-h" className="sr-only">
          Measured on real deploys
        </h2>
        <dl className="grid grid-cols-2 gap-px bg-gray-alpha-400 md:grid-cols-5">
          {RESULTS.map((r, i) => (
            <div key={r.label} className={cx("bg-background-100 px-6 py-8", i === RESULTS.length - 1 && "col-span-2 md:col-span-1")}>
              <dt className="sr-only">{r.label}</dt>
              <dd>
                <span className="tabular text-heading-32 text-gray-1000">{r.value}</span>
                <span className="ml-1 font-mono text-label-13 text-gray-900">{r.unit}</span>
                <p className="mt-2 text-copy-13 text-gray-900">{r.label}</p>
              </dd>
            </div>
          ))}
        </dl>
        <p className="border-t border-gray-alpha-400 px-6 py-3 text-label-13 text-gray-900">Measured on real deploys.</p>
      </section>

      {/* Rollouts */}
      <section id="features" aria-labelledby="rollouts-h" className={cx(frame, "scroll-mt-16")}>
        <div className="grid gap-px bg-gray-alpha-400 lg:grid-cols-2">
          <div className="bg-background-100 px-6 py-14 md:px-12 md:py-20">
            <SectionHeading id="rollouts-h" kicker="Rollouts">
              Blue-green and canary, with automatic rollback
            </SectionHeading>
            <p className="mt-5 text-copy-16 text-gray-900">
              The new version starts next to the live one and must pass its health check before it gets any traffic. With canary on,
              it then takes 20%, then 50%, for 15 seconds each, while Forge compares its 5xx rate and latency with the live version
              over the same window.
            </p>
            <ul className="mt-8 space-y-3 text-copy-14 text-gray-1000">
              <li className="flex gap-3">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-gray-1000" aria-hidden />
                More than 5 points more errors, or 2× and 200 ms slower: traffic goes back to the live version at once.
              </li>
              <li className="flex gap-3">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-gray-1000" aria-hidden />A release with 30% failing pages
                was rolled back at 20%; visitors saw 3 errors in 574 requests.
              </li>
              <li className="flex gap-3">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-gray-1000" aria-hidden />A failed version never replaces a
                working one.
              </li>
            </ul>
          </div>
          <div className="flex items-center bg-background-200 px-6 py-14 md:px-12">
            <div className="w-full overflow-hidden rounded-lg border border-gray-alpha-400 bg-background-100 font-mono text-label-13">
              <p className="border-b border-gray-alpha-400 px-4 py-2.5 text-gray-900">deployment timeline</p>
              <ol className="space-y-2.5 p-4">
                {TIMELINE.map(([s, tone], i) => (
                  <li key={s} className="flex items-center gap-3">
                    <span className="tabular w-5 text-gray-900">{i + 1}</span>
                    <span className={TIMELINE_TONE[tone]}>{s}</span>
                    <span className="h-px flex-1 bg-gray-alpha-400" />
                    {tone === "live" && <span className="size-2 rounded-full bg-green-700" aria-hidden />}
                    {tone === "canary" && <span className="size-2 rounded-full bg-blue-700" aria-hidden />}
                  </li>
                ))}
              </ol>
              <p className="border-t border-gray-alpha-400 px-4 py-3 text-gray-900">
                or <span className="text-red-900">FAILED(CANARY_REGRESSION)</span> → live version keeps 100%
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Agent */}
      <section aria-labelledby="agent-h" className={frame}>
        <div className="grid gap-px bg-gray-alpha-400 lg:grid-cols-2">
          <div className="bg-background-100 px-6 py-14 md:px-12 md:py-20">
            <SectionHeading id="agent-h" kicker="Forge Agent">
              A failed deploy comes with a reason and a fix
            </SectionHeading>
            <p className="mt-5 text-copy-16 text-gray-900">
              When a deploy fails, the agent collects the logs, the failure detail and the project&apos;s config, redacts every
              secret, and diagnoses the cause. It uses Claude when an API key is set, and 13 built-in rules offline. Any LLM error
              falls back to the rules.
            </p>
            <ul className="mt-8 flex flex-wrap gap-1.5" aria-label="Diagnosis rules">
              {RULES.map((r) => (
                <li key={r} className="rounded-sm border border-gray-alpha-400 px-1.5 py-0.5 font-mono text-label-12 text-gray-900">
                  {r}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-center bg-background-200 px-6 py-14 md:px-12">
            <div className="w-full">
              <DiagnosisCard />
            </div>
          </div>
        </div>
      </section>

      {/* Small features */}
      <section aria-labelledby="more-h" className={frame}>
        <SectionHeading id="more-h" kicker="Runtime" className="px-6 py-14 md:px-12 md:py-16">
          The parts you would otherwise script yourself
        </SectionHeading>
        <div className="grid gap-px border-t border-gray-alpha-400 bg-gray-alpha-400 sm:grid-cols-2 lg:grid-cols-3">
          {SMALL_FEATURES.map((f) => (
            <div key={f.title} className="bg-background-100 p-6 md:p-8">
              <div className="flex items-center gap-2">
                <f.icon className="size-4 text-gray-1000" aria-hidden />
                <h3 className="text-heading-16 text-gray-1000">{f.title}</h3>
              </div>
              <p className="mt-2 text-copy-14 text-gray-900">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" aria-labelledby="how-h" className={cx(frame, "scroll-mt-16")}>
        <div className="flex flex-wrap items-end justify-between gap-4 px-6 py-14 md:px-12 md:py-16">
          <SectionHeading id="how-h" kicker="How it works" className="max-w-xl">
            From git push to live in five steps
          </SectionHeading>
          <Link href="/architecture" className={buttonClass("secondary", "md")}>
            See the architecture <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <ol className="grid gap-px border-t border-gray-alpha-400 bg-gray-alpha-400 sm:grid-cols-2 md:grid-cols-5">
          {STEPS.map((s) => (
            <li key={s.n} className="bg-background-100 p-6">
              <span className="font-mono text-label-13 text-gray-900">{s.n}</span>
              <h3 className="mt-3 text-heading-16 text-gray-1000">{s.title}</h3>
              <p className="mt-2 text-copy-14 text-gray-900">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Stack */}
      <section aria-labelledby="stack-h" className={frame}>
        <SectionHeading id="stack-h" kicker="Stack" className="px-6 py-14 md:px-12 md:py-16">
          Built on boring, proven parts
        </SectionHeading>
        <ul className="grid gap-px border-t border-gray-alpha-400 bg-gray-alpha-400 sm:grid-cols-2 lg:grid-cols-3">
          {STACK.map((s) => (
            <li key={s.name} className="bg-background-100 p-6">
              <p className="font-mono text-label-14 font-medium text-gray-1000">{s.name}</p>
              <p className="mt-1 text-copy-14 text-gray-900">{s.note}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* CTA */}
      <section aria-labelledby="cta-h" className={cx(frame, "relative overflow-hidden")}>
        <div className="grid-backdrop absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_70%)]" aria-hidden />
        <div className="relative px-6 py-20 text-center md:py-28">
          <h2 id="cta-h" className="text-heading-40 text-gray-1000 md:text-heading-48">
            Deploy something.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-copy-16 text-gray-900">Sign in with the demo account and deploy a sample app.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/login" className={buttonClass("primary", "lg")}>
              Try the demo <ArrowRight className="size-4" aria-hidden />
            </Link>
            <a href={GITHUB_URL} className={buttonClass("secondary", "lg")}>
              <GithubIcon className="size-4" /> View source
            </a>
          </div>
          <p className="mt-6 inline-flex items-center gap-1.5 font-mono text-label-12 text-gray-900">
            <GitBranch className="size-3" aria-hidden /> github.com/sshivanshg/forge
          </p>
        </div>
      </section>
    </div>
  );
}
