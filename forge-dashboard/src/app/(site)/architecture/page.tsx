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
      <p className="font-mono text-label-13 text-gray-900">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-heading-32 text-gray-1000">
        {children}
      </h2>
    </>
  );
}

const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded-sm bg-gray-alpha-200 px-1 py-0.5 font-mono text-[0.9em] text-gray-1000">{children}</code>
);

const section = "border-t border-gray-alpha-400 py-16 md:py-20";

export default function ArchitecturePage() {
  return (
    <>
      <header className="relative overflow-hidden border-b border-gray-alpha-400">
        <div className="grid-backdrop absolute inset-0 [mask-image:radial-gradient(ellipse_at_top_left,black_20%,transparent_70%)]" aria-hidden />
        <div className="relative mx-auto max-w-[1200px] px-4 py-16 sm:px-6 md:py-24">
          <p className="text-label-13 font-medium text-gray-900">Architecture</p>
          <h1 className="mt-3 max-w-3xl text-heading-48 text-gray-1000 md:text-heading-64">
            How Forge is built
          </h1>
          <p className="mt-6 max-w-2xl text-copy-16 text-gray-900 md:text-copy-20">
            A Spring Boot control plane of 11 modules decides what should run and records it in PostgreSQL. The container engine and
            Traefik run and route the apps. Select any component to see what it owns.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <section aria-labelledby="system" className="py-16 md:py-20">
          <H2 id="system" eyebrow="01 · System">
            Components and modules
          </H2>
          <p className="mb-8 mt-4 max-w-2xl text-copy-16 text-gray-900">
            Dependencies point from orchestration (<Code>deployment</Code>) down to capabilities. The graph has no cycles;{" "}
            <Code>agent</Code> and <Code>notification</Code> only react to the DeploymentStatusChanged event (dashed).
          </p>
          <ArchitectureExplorer />
        </section>

        <section aria-labelledby="states" className={section}>
          <H2 id="states" eyebrow="02 · State">
            Deployment state machine
          </H2>
          <p className="mb-8 mt-4 max-w-2xl text-copy-16 text-gray-900">
            <Code>DeploymentStatus</Code> holds the transition table and <Code>Deployment.transitionTo()</Code> refuses anything else
            (State pattern). Terminal states have no way out.
          </p>
          <StateMachine />
        </section>

        <section aria-labelledby="flow" className={section}>
          <H2 id="flow" eyebrow="03 · Flow">
            git push to live
          </H2>
          <ol className="mt-10 overflow-hidden rounded-lg border border-gray-alpha-400 bg-background-100">
            {FLOW.map((f, i) => (
              <li key={i} className="grid gap-1 border-t border-gray-alpha-400 px-5 py-4 first:border-t-0 md:grid-cols-[48px_300px_1fr] md:gap-4">
                <span className="tabular font-mono text-label-13 text-gray-900">{String(i + 1).padStart(2, "0")}</span>
                <p className="font-mono text-label-13 text-gray-1000">{f.who}</p>
                <p className="text-copy-14 text-gray-900">{f.what}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="why" className={section}>
          <H2 id="why" eyebrow="04 · Trade-offs">
            Why it is built this way
          </H2>
          <dl className="mt-10 grid gap-px overflow-hidden rounded-lg border border-gray-alpha-400 bg-gray-alpha-400 sm:grid-cols-2">
            {WHY.map(([t, b]) => (
              <div key={t} className="bg-background-100 p-6">
                <dt className="text-heading-16 text-gray-1000">{t}</dt>
                <dd className="mt-2 text-copy-14 text-gray-900">{b}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="decisions" className={section}>
          <H2 id="decisions" eyebrow="05 · Decision log">
            Design decisions
          </H2>
          <ol className="mt-10 border-t border-gray-alpha-400">
            {DECISIONS.map((d) => (
              <li key={d.id} className="grid gap-2 border-b border-gray-alpha-400 py-6 sm:grid-cols-[100px_1fr]">
                <span className="font-mono text-label-13 text-gray-900">{d.id}</span>
                <div>
                  <h3 className="text-heading-16 text-gray-1000">{d.title}</h3>
                  <p className="mt-1.5 max-w-3xl text-copy-14 text-gray-900">{d.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
