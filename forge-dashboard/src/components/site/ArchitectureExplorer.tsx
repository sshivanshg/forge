"use client";

import { useState } from "react";
import { cx } from "@/components/ui/cx";

type Kind = "client" | "module" | "data" | "infra" | "external";

interface Node {
  id: string;
  label: string;
  sub: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: Kind;
  role: string;
  classes: string[];
  patterns: string[];
}

const MW = 150;
const MH = 54;
const col = (i: number) => 262 + i * 166;
const row = (i: number) => 74 + i * 78;

const NODES: Node[] = [
  { id: "dashboard", label: "Dashboard", sub: "Next.js 16 · :3000", x: 30, y: 74, w: 170, h: MH, kind: "client",
    role: "The browser UI. Calls the REST API with a JWT and opens Server-Sent Event streams for live build and runtime logs.",
    classes: ["AuthProvider", "useEventStream", "lib/api.ts"], patterns: ["SSE with Last-Event-ID resume"] },
  { id: "github", label: "GitHub", sub: "OAuth · repos · webhooks", x: 30, y: 230, w: 170, h: MH, kind: "external",
    role: "Hosts the code, authenticates users with OAuth and sends signed push webhooks.",
    classes: ["—"], patterns: ["External system"] },
  { id: "identity", label: "identity", sub: "users · JWT", x: col(0), y: row(0), w: MW, h: MH, kind: "module",
    role: "Registration, login, 15-minute JWT access tokens and rotating refresh tokens. Reusing an old refresh token is treated as theft and signs the user out everywhere.",
    classes: ["AuthService", "JwtService", "JwtAuthenticationFilter", "DemoAccountSeeder"], patterns: ["Factory Method (User.register)", "Repository"] },
  { id: "project", label: "project", sub: "projects · env vars", x: col(1), y: row(0), w: MW, h: MH, kind: "module",
    role: "Projects, their build and run settings, and environment variables encrypted with AES-256-GCM and masked in every response.",
    classes: ["ProjectService", "EnvironmentService", "ProjectCatalog", "Slug", "RepoRef", "BuildSettings"], patterns: ["Value Object", "Facade (ProjectCatalog)"] },
  { id: "source", label: "source", sub: "git · webhooks", x: col(2), y: row(0), w: MW, h: MH, kind: "module",
    role: "Talks to Git: GitHub OAuth, listing repos, shallow-cloning an exact commit with JGit, and verifying HMAC-SHA256 push webhooks.",
    classes: ["WebhookService", "JGitSourceCodeProvider", "GitHubApiClient", "OAuthStateStore"], patterns: ["Adapter", "Idempotent Receiver"] },
  { id: "deployment", label: "deployment", sub: "state machine · rollouts", x: col(0), y: row(1), w: MW, h: MH, kind: "module",
    role: "The heart: the deployment state machine, BUILD and DEPLOY job handlers, blue-green and canary rollouts, rollback, cancel and self-healing.",
    classes: ["Deployment", "DeploymentStatus", "DeploymentTransitions", "BlueGreenRollout", "CanaryRollout", "CanaryAnalysis", "RolloutSelector", "LiveInstanceWatcher"],
    patterns: ["State", "Strategy (RolloutStrategy)", "Aggregate Root + domain events", "Facade (DeploymentService)", "Optimistic locking"] },
  { id: "build", label: "build", sub: "detect · Dockerfile · image", x: col(1), y: row(1), w: MW, h: MH, kind: "module",
    role: "Turns source into an image: a chain of detectors picks the stack, a strategy writes the Dockerfile, the engine builds it.",
    classes: ["DefaultBuildService", "DetectorChain", "BuildStrategyFactory", "TemplateBuildStrategy", "AppleContainerImageBuilder", "RetryingImageBuilder"],
    patterns: ["Chain of Responsibility", "Factory", "Template Method", "Decorator", "Adapter"] },
  { id: "jobs", label: "jobs", sub: "queue · workers", x: col(2), y: row(1), w: MW, h: MH, kind: "module",
    role: "A durable job queue on Postgres: SKIP LOCKED claiming, leases, heartbeat, a reaper, exponential backoff and dead-lettering. One virtual thread per job.",
    classes: ["PostgresJobQueue", "JobRunner", "AbstractJobHandler", "Job"], patterns: ["Command", "Template Method", "Lease and Heartbeat"] },
  { id: "runtime", label: "runtime", sub: "containers · routing", x: col(0), y: row(2), w: MW, h: MH, kind: "module",
    role: "Starts and stops app containers, each in its own lightweight VM with resource limits; serves Traefik its routing table and splits canary traffic by weight.",
    classes: ["RuntimeProvider", "AppleContainerRuntimeProvider", "AppleRoutingTable", "TraefikMetrics", "ContainerSpec", "DockerRuntimeProvider"],
    patterns: ["Adapter", "Strategy (engine)", "Builder (ContainerSpec)", "Ports and Adapters"] },
  { id: "health", label: "health", sub: "HTTP probe", x: col(1), y: row(2), w: MW, h: MH, kind: "module",
    role: "Polls the app's health URL every 2 s until it answers 2xx/3xx, times out, or the container dies.",
    classes: ["HealthProbe", "HttpHealthProbe"], patterns: ["Adapter"] },
  { id: "logs", label: "logs", sub: "store · live stream", x: col(2), y: row(2), w: MW, h: MH, kind: "module",
    role: "Stores build and runtime log lines with sequence numbers and streams them over SSE, resuming from Last-Event-ID.",
    classes: ["LogBroadcaster", "JdbcLogStore", "LogSink", "LogReader"], patterns: ["Observer", "Interface Segregation (LogSink / LogReader)"] },
  { id: "agent", label: "agent", sub: "failure investigator", x: col(0), y: row(3), w: MW, h: MH, kind: "module",
    role: "On a failed deploy, collects evidence, redacts secrets and diagnoses the cause: Claude if a key is set, otherwise 13 ordered rules.",
    classes: ["FailureInvestigator", "DiagnosisRules", "RuleBasedDiagnosisEngine", "ClaudeDiagnosisEngine", "SecretRedactor"],
    patterns: ["Observer", "Strategy (DiagnosisEngine)", "Chain of Responsibility"] },
  { id: "notification", label: "notification", sub: "email", x: col(1), y: row(3), w: MW, h: MH, kind: "module",
    role: "Listens for status changes and emails the owner when a deploy goes live or fails. Async and after commit.",
    classes: ["DeploymentNotifier", "EmailChannel", "NotificationChannel"], patterns: ["Observer", "Strategy (NotificationChannel)"] },
  { id: "shared", label: "shared", sub: "errors · crypto · CLI", x: col(2), y: row(3), w: MW, h: MH, kind: "module",
    role: "Open module: the error model (ErrorCode, RFC 9457 ProblemDetail), AES-256-GCM encryption, correlation ids and ContainerCli.",
    classes: ["GlobalExceptionHandler", "EncryptionService", "ContainerCli", "CorrelationIdFilter"], patterns: ["Singleton (Spring beans)"] },
  { id: "postgres", label: "PostgreSQL 16", sub: "data · job queue · logs", x: 790, y: 74, w: 180, h: 62, kind: "data",
    role: "All state, the audit trail, log lines and the job queue. Enqueue happens in the same transaction as the deployment insert, so there is no dual-write problem.",
    classes: ["Flyway V1–V9", "ux_deployments_one_active"], patterns: ["FOR UPDATE SKIP LOCKED", "Partial unique index"] },
  { id: "llm", label: "Anthropic API", sub: "optional", x: 790, y: 230, w: 180, h: MH, kind: "external",
    role: "Optional LLM for diagnosis. Receives only redacted failure context; any error falls back to the rules.",
    classes: ["ClaudeDiagnosisEngine"], patterns: ["Fallback"] },
  { id: "mail", label: "Mailpit / SMTP", sub: "LIVE · FAILED emails", x: 790, y: 308, w: 180, h: MH, kind: "external",
    role: "Receives notification emails in development.", classes: ["EmailChannel"], patterns: ["—"] },
  { id: "engine", label: "Apple container", sub: "build · run · VM per app", x: 262, y: 470, w: 200, h: 62, kind: "infra",
    role: "The container engine. Each app runs in its own lightweight Linux VM. Docker via docker-java is the alternative (forge.engine=docker).",
    classes: ["ContainerCli", "AppleContainerImageBuilder", "AppleContainerRuntimeProvider"], patterns: ["Adapter", "Dependency Inversion"] },
  { id: "traefik", label: "Traefik v3", sub: "proxy · weighted split", x: 500, y: 470, w: 170, h: 62, kind: "infra",
    role: "Routes slug.localhost to the right app. Polls GET /internal/routing every second (token-protected); weights per version split canary traffic; Prometheus counters feed CanaryAnalysis.",
    classes: ["RoutingController", "AppleRoutingTable", "TraefikRoutes"], patterns: ["Data plane separate from control plane"] },
  { id: "apps", label: "User apps", sub: "blue · green · replicas", x: 790, y: 470, w: 180, h: 62, kind: "infra",
    role: "The deployed applications. During a rollout the live (blue) and new (green) versions run side by side; 1–3 replicas each.",
    classes: ["RunningInstance"], patterns: ["Blue-green", "Canary"] },
  { id: "visitor", label: "Visitor", sub: "slug.localhost", x: 30, y: 470, w: 170, h: 62, kind: "client",
    role: "End users of a deployed app. Their traffic never passes through forge-server, so restarting Forge takes no app down.",
    classes: ["—"], patterns: ["—"] },
];

const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));

type Edge = { from: string; to: string; label?: string; dashed?: boolean };
const EDGES: Edge[] = [
  { from: "dashboard", to: "identity", label: "JSON · SSE" },
  { from: "github", to: "source", label: "webhook" },
  { from: "deployment", to: "project" },
  { from: "deployment", to: "source" },
  { from: "deployment", to: "build" },
  { from: "deployment", to: "runtime" },
  { from: "deployment", to: "health" },
  { from: "deployment", to: "jobs" },
  { from: "deployment", to: "logs" },
  { from: "build", to: "source" },
  { from: "agent", to: "deployment", dashed: true },
  { from: "notification", to: "deployment", dashed: true },
  { from: "jobs", to: "postgres", label: "SKIP LOCKED" },
  { from: "agent", to: "llm", dashed: true },
  { from: "notification", to: "mail" },
  { from: "runtime", to: "engine" },
  { from: "build", to: "engine" },
  { from: "traefik", to: "runtime", label: "/internal/routing", dashed: true },
  { from: "engine", to: "apps" },
  { from: "traefik", to: "apps" },
  { from: "visitor", to: "traefik" },
];

function anchor(n: Node, toward: Node) {
  const cx = n.x + n.w / 2;
  const cy = n.y + n.h / 2;
  const dx = toward.x + toward.w / 2 - cx;
  const dy = toward.y + toward.h / 2 - cy;
  if (Math.abs(dx) * n.h > Math.abs(dy) * n.w) return { x: cx + (Math.sign(dx) * n.w) / 2, y: cy };
  return { x: cx, y: cy + (Math.sign(dy) * n.h) / 2 };
}

const KIND_LABEL: Record<Kind, string> = {
  client: "client",
  module: "module",
  data: "data store",
  infra: "infrastructure",
  external: "external",
};

const LEGEND_NODE: Node = { ...NODES[0], x: 0, y: 0 };

/** Node marker per kind — monochrome; shape, not colour, tells kinds apart. */
function KindMark({ n }: { n: Node }) {
  const x = n.x + 14;
  const y = n.y + 20;
  switch (n.kind) {
    case "module":
      return <rect x={x - 3.5} y={y - 3.5} width="7" height="7" rx="1.5" fill="var(--ds-gray-1000)" />;
    case "data":
      return <rect x={x - 3.5} y={y - 3.5} width="7" height="7" rx="1.5" fill="none" stroke="var(--ds-gray-1000)" strokeWidth="1.2" />;
    case "infra":
      return <path d={`M${x} ${y - 4} L${x + 4} ${y + 3.5} L${x - 4} ${y + 3.5} Z`} fill="var(--ds-gray-1000)" />;
    case "external":
      return <circle cx={x} cy={y} r="3.5" fill="none" stroke="var(--ds-gray-900)" strokeWidth="1.2" />;
    default:
      return <circle cx={x} cy={y} r="3.5" fill="var(--ds-gray-900)" />;
  }
}

export function ArchitectureExplorer() {
  const [selected, setSelected] = useState<string>("deployment");
  const node = byId[selected];
  const related = new Set(EDGES.filter((e) => e.from === selected || e.to === selected).flatMap((e) => [e.from, e.to]));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="self-start overflow-hidden rounded-lg border border-gray-alpha-400 bg-background-100">
        <div className="scrollbar-thin overflow-x-auto">
          <svg
            viewBox="0 0 1000 560"
            className="min-w-[760px]"
            role="group"
            aria-label="Forge system architecture. Select a component for details."
          >
            <defs>
              <marker id="ae-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0 0 8 4 0 8z" fill="var(--ds-gray-700)" />
              </marker>
              <marker id="ae-arrow-hot" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0 0 8 4 0 8z" fill="var(--ds-blue-700)" />
              </marker>
            </defs>
            <rect
              x="242"
              y="30"
              width="520"
              height="384"
              rx="10"
              fill="var(--ds-gray-alpha-100)"
              stroke="var(--ds-gray-alpha-500)"
              strokeDasharray="4 4"
            />
            <text x="258" y="54" fill="var(--ds-gray-1000)" className="font-mono" fontSize="11">
              forge-server · Spring Boot modular monolith · :8080
            </text>
            <text x="790" y="54" fill="var(--ds-gray-900)" className="font-mono" fontSize="11">
              data & external
            </text>
            <text x="262" y="456" fill="var(--ds-gray-900)" className="font-mono" fontSize="11">
              data plane
            </text>
            {EDGES.map((e, i) => {
              const a = byId[e.from];
              const b = byId[e.to];
              const p1 = anchor(a, b);
              const p2 = anchor(b, a);
              const hot = e.from === selected || e.to === selected;
              return (
                <g key={i}>
                  <line
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke={hot ? "var(--ds-blue-700)" : "var(--ds-gray-alpha-500)"}
                    strokeWidth={hot ? 1.5 : 1}
                    strokeDasharray={e.dashed ? "4 4" : undefined}
                    markerEnd={`url(#${hot ? "ae-arrow-hot" : "ae-arrow"})`}
                    className={hot ? "site-flow" : undefined}
                  />
                  {e.label && (
                    <text
                      x={(p1.x + p2.x) / 2}
                      y={(p1.y + p2.y) / 2 - 5}
                      textAnchor="middle"
                      fontSize="9.5"
                      fill={hot ? "var(--ds-blue-900)" : "var(--ds-gray-900)"}
                      className="font-mono"
                    >
                      {e.label}
                    </text>
                  )}
                </g>
              );
            })}
            {NODES.map((n) => {
              const active = n.id === selected;
              const dim = !active && !related.has(n.id);
              return (
                <g
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={active}
                  aria-label={`${n.label}: ${n.sub}`}
                  onClick={() => setSelected(n.id)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      setSelected(n.id);
                    }
                  }}
                  className="cursor-pointer outline-none [&:focus-visible>rect:first-child]:stroke-[var(--ds-blue-700)] [&:focus-visible>rect:first-child]:[stroke-width:2]"
                  style={{
                    opacity: dim ? 0.5 : 1,
                    transition: "opacity 150ms",
                  }}
                >
                  <rect
                    x={n.x}
                    y={n.y}
                    width={n.w}
                    height={n.h}
                    rx="8"
                    fill="var(--ds-background-100)"
                    stroke={active ? "var(--ds-gray-1000)" : "var(--ds-gray-alpha-500)"}
                    strokeWidth={active ? 1.5 : 1}
                  />
                  {active && <rect x={n.x} y={n.y + 10} width="2" height={n.h - 20} rx="1" fill="var(--ds-blue-700)" />}
                  <KindMark n={n} />
                  <text x={n.x + 25} y={n.y + 24} fontSize="13" fontWeight="600" fill="var(--ds-gray-1000)" className="font-mono">
                    {n.label}
                  </text>
                  <text x={n.x + 14} y={n.y + 42} fontSize="10" fill="var(--ds-gray-900)">
                    {n.sub}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <ul aria-label="Legend" className="flex flex-wrap gap-x-5 gap-y-2 border-t border-gray-alpha-400 bg-background-200 px-4 py-3">
          {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
            <li key={k} className="inline-flex items-center gap-2 text-label-12 text-gray-900">
              <svg viewBox="9 15 10 10" className="size-2.5" aria-hidden>
                <KindMark n={{ ...LEGEND_NODE, kind: k }} />
              </svg>
              {KIND_LABEL[k]}
            </li>
          ))}
          <li className="inline-flex items-center gap-2 text-label-12 text-gray-900">
            <svg viewBox="0 0 20 4" className="h-1 w-5" aria-hidden>
              <line x1="0" y1="2" x2="20" y2="2" stroke="var(--ds-gray-900)" strokeDasharray="4 4" />
            </svg>
            event / async
          </li>
        </ul>
      </div>

      <aside aria-live="polite" className="self-start rounded-lg border border-gray-alpha-400 bg-background-100">
        <div className="border-b border-gray-alpha-400 p-5">
          <p className="font-mono text-label-12 text-gray-900">{node.kind === "module" ? `com.forge.${node.id}` : KIND_LABEL[node.kind]}</p>
          <h3 className="mt-1 font-mono text-heading-20 text-gray-1000">{node.label}</h3>
          <p className="mt-3 text-copy-14 text-gray-900">{node.role}</p>
        </div>
        <div className="space-y-5 p-5">
          <div>
            <h4 className="text-label-13 font-medium text-gray-1000">Key classes</h4>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {node.classes.map((c) => (
                <li key={c} className="rounded-sm bg-gray-alpha-200 px-1.5 py-0.5 font-mono text-label-12 text-gray-1000">
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-label-13 font-medium text-gray-1000">Patterns</h4>
            <ul className="mt-2 space-y-1">
              {node.patterns.map((p) => (
                <li key={p} className="text-copy-13 text-gray-900">
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="rounded-b-lg border-t border-gray-alpha-400 bg-background-200 p-5">
          <p className="mb-2 text-label-12 text-gray-900">Jump to module</p>
          <div className="flex flex-wrap gap-1">
            {NODES.filter((n) => n.kind === "module").map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setSelected(n.id)}
                aria-pressed={n.id === selected}
                className={cx(
                  "focus-ring rounded-md px-1.5 py-0.5 font-mono text-label-12 transition-colors",
                  n.id === selected ? "bg-gray-1000 text-background-100" : "text-gray-900 hover:bg-gray-alpha-200 hover:text-gray-1000",
                )}
              >
                {n.label}
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
