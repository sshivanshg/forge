import type { Metadata } from "next";
import { ArchitectureExplorer } from "@/components/site/ArchitectureExplorer";
import { StateMachine } from "@/components/site/StateMachine";

export const metadata: Metadata = {
  title: "Architecture",
  description:
    "How Forge is built: a Spring Boot modular monolith of 11 modules, a PostgreSQL job queue, Apple container and Traefik. Modules, state machine, request flow and design decisions.",
};

const FLOW = [
  { who: "WebhookService", what: "GitHub sends a push. The HMAC-SHA256 signature is checked in constant time; a seen delivery id is ignored." },
  { who: "JwtAuthenticationFilter", what: "Or a user clicks Deploy. The token is validated; the project is loaded by id and owner (404, never 403)." },
  { who: "SourceCodeProvider", what: "The branch is resolved to an exact 40-character SHA, so the deploy is reproducible." },
  { who: "DeploymentTransitions", what: "One transaction: Deployment(QUEUED) is saved and a BUILD job enqueued. The API returns 202." },
  { who: "JobRunner", what: "A virtual-thread worker claims the job with FOR UPDATE SKIP LOCKED, takes a lease and heartbeats it." },
  { who: "JGitSourceCodeProvider", what: "Shallow-clones that SHA into a temporary folder that is always deleted." },
  { who: "DetectorChain · BuildStrategyFactory", what: "Picks Dockerfile, Maven, Gradle or Node and writes the Dockerfile if needed." },
  { who: "AppleContainerImageBuilder", what: "Runs container build. Every output line goes through LogSink to the DB and the live SSE stream." },
  { who: "DeploymentTransitions", what: "BUILDING → DEPLOYING and a DEPLOY job, again in one transaction." },
  { who: "RolloutSelector · RuntimeProvider", what: "Picks blue-green or canary and starts the new version in its own VM, with decrypted env vars and limits." },
  { who: "HttpHealthProbe · ListeningPortWatch", what: "Polls the health path every 2 s for up to 90 s; ends early on a crash or a wrong port." },
  { who: "CanaryRollout · CanaryAnalysis", what: "Canary only: 20% then 50% for 15 s each, comparing 5xx rate and latency with the live version." },
  { who: "AppleRoutingTable · Traefik", what: "LIVE: traffic switches, the old version is drained and stopped, and becomes SUPERSEDED." },
  { who: "FailureInvestigator", what: "Or FAILED: the new version is removed, the old one never stopped, and the agent writes an insight." },
];

const DECISIONS = [
  { id: "D-006", title: "Canary rollouts with automatic rollback, and replicas", body: "A second RolloutStrategy beside blue-green. Traffic split by Traefik weights, judged by per-version Prometheus counters. 1–3 replicas per project." },
  { id: "D-005", title: "Self-healing and early port-mismatch failure", body: "LiveInstanceWatcher queues a RECOVERY deployment of the same image when a live container disappears. ListeningPortWatch fails a wrong port in seconds instead of the 90 s timeout." },
  { id: "D-004", title: "User apps run on Apple container, not Docker", body: "New ImageBuilder and RuntimeProvider adapters; Traefik polls a routing table. The deployment module did not change: Dependency Inversion and Liskov Substitution in practice." },
  { id: "D-003", title: "Scope frozen: Milestone 1 plus the agent", body: "Two jobs per deployment (BUILD, then DEPLOY) so rollbacks skip the build. Agent is rules first, LLM optional. Kafka, Redis, Kubernetes and AWS are future work." },
  { id: "D-002", title: "Kubernetes dropped", body: "Not feasible in the course timeline. RuntimeProvider stays an interface, so a Kubernetes adapter remains possible." },
  { id: "D-001", title: "Forge is an agentic platform", body: "The agent is core scope: it uses Forge's own services as tools to explain failed deploys." },
];

const WHY = [
  ["Modular monolith", "One deployable, boundaries enforced by ArchitectureTest (Spring Modulith). Modules can be extracted later."],
  ["Postgres as the job queue", "Enqueue in the same transaction as the insert, no dual write. SKIP LOCKED gives safe concurrent workers."],
  ["Java 21 virtual threads", "Builds and health checks are I/O-bound: one thread per job without a reactive rewrite."],
  ["Control plane ≠ data plane", "Visitor traffic never passes through forge-server, so restarting Forge takes no app down."],
];

function H2({ id, eyebrow, children }: { id: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brand-400">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
        {children}
      </h2>
    </>
  );
}

export default function ArchitecturePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <header className="py-14">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-brand-400">Architecture</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">How Forge is built</h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-zinc-400">
          A Spring Boot control plane of 11 modules decides what should run and records it in PostgreSQL. The container engine and
          Traefik run and route the apps. Select any component to see what it owns.
        </p>
      </header>

      <section aria-labelledby="system" className="pb-20">
        <H2 id="system" eyebrow="01 · System">
          Components and modules
        </H2>
        <p className="mb-6 mt-3 max-w-2xl text-[14px] text-zinc-400">
          Dependencies point from orchestration (<code className="font-mono text-brand-200">deployment</code>) down to capabilities. The
          graph has no cycles; <code className="font-mono text-brand-200">agent</code> and{" "}
          <code className="font-mono text-brand-200">notification</code> only react to the DeploymentStatusChanged event (dashed).
        </p>
        <ArchitectureExplorer />
      </section>

      <section aria-labelledby="states" className="border-t border-white/[0.06] py-20">
        <H2 id="states" eyebrow="02 · State">
          Deployment state machine
        </H2>
        <p className="mb-6 mt-3 max-w-2xl text-[14px] text-zinc-400">
          <code className="font-mono text-brand-200">DeploymentStatus</code> holds the transition table and{" "}
          <code className="font-mono text-brand-200">Deployment.transitionTo()</code> refuses anything else (State pattern).Terminal states have no way out.
        </p>
        <StateMachine />
      </section>

      <section aria-labelledby="flow" className="border-t border-white/[0.06] py-20">
        <H2 id="flow" eyebrow="03 · Flow">
          git push to live
        </H2>
        <ol className="mt-10 border-l border-white/[0.08]">
          {FLOW.map((f, i) => (
            <li key={i} className="relative pb-6 pl-8 last:pb-0">
              <span className="absolute -left-[13px] top-0 flex size-[26px] items-center justify-center rounded-full border border-white/10 bg-ink-900 font-mono text-[10.5px] text-brand-300 tabular">
                {i + 1}
              </span>
              <p className="font-mono text-[12.5px] text-brand-200">{f.who}</p>
              <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-zinc-400">{f.what}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="why" className="border-t border-white/[0.06] py-20">
        <H2 id="why" eyebrow="04 · Trade-offs">
          Why it is built this way
        </H2>
        <dl className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {WHY.map(([t, b]) => (
            <div key={t} className="border-t border-white/[0.08] pt-4">
              <dt className="text-[15px] font-medium text-zinc-100">{t}</dt>
              <dd className="mt-1.5 text-[13.5px] leading-relaxed text-zinc-400">{b}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="decisions" className="border-t border-white/[0.06] py-20">
        <H2 id="decisions" eyebrow="05 · Decision log">
          Design decisions
        </H2>
        <ol className="mt-10 space-y-6">
          {DECISIONS.map((d) => (
            <li key={d.id} className="grid gap-2 sm:grid-cols-[80px_1fr]">
              <span className="font-mono text-[12px] text-brand-400">{d.id}</span>
              <div>
                <h3 className="text-[15px] font-medium text-zinc-100">{d.title}</h3>
                <p className="mt-1 max-w-3xl text-[13.5px] leading-relaxed text-zinc-400">{d.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
