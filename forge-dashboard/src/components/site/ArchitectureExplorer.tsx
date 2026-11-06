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

const KIND_STYLE: Record<Kind, { stroke: string; dot: string }> = {
  client: { stroke: "#a1a1aa", dot: "#e4e4e7" },
  module: { stroke: "#f76b15", dot: "#ff8a3d" },
  data: { stroke: "#a78bfa", dot: "#c4b5fd" },
  infra: { stroke: "#22d3ee", dot: "#67e8f9" },
  external: { stroke: "#52525b", dot: "#a1a1aa" },
};

export function ArchitectureExplorer() {
  const [selected, setSelected] = useState<string>("deployment");
  const node = byId[selected];
  const related = new Set(EDGES.filter((e) => e.from === selected || e.to === selected).flatMap((e) => [e.from, e.to]));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="scrollbar-thin overflow-x-auto rounded-xl border border-white/[0.08] bg-ink-900/60 dot-grid">
        <svg viewBox="0 0 1000 560" className="min-w-[760px]" role="group" aria-label="Forge system architecture. Select a component for details.">
          <defs>
            <marker id="ae-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0 0 8 4 0 8z" fill="#71717a" />
            </marker>
            <marker id="ae-arrow-hot" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0 0 8 4 0 8z" fill="#ff8a3d" />
            </marker>
          </defs>
          <rect x="242" y="30" width="520" height="384" rx="14" fill="rgb(247 107 21 / 0.03)" stroke="rgb(247 107 21 / 0.25)" strokeDasharray="4 4" />
          <text x="258" y="54" className="fill-brand-300 font-mono" fontSize="11">forge-server · Spring Boot modular monolith · :8080</text>
          <text x="790" y="54" className="fill-zinc-500 font-mono" fontSize="11">data & external</text>
          <text x="262" y="456" className="fill-zinc-500 font-mono" fontSize="11">data plane</text>
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
                  stroke={hot ? "#ff8a3d" : "rgb(161 161 170 / 0.35)"}
                  strokeWidth={hot ? 1.6 : 1}
                  strokeDasharray={e.dashed ? "4 4" : undefined}
                  markerEnd={`url(#${hot ? "ae-arrow-hot" : "ae-arrow"})`}
                  className={hot ? "site-flow" : undefined}
                />
                {e.label && (
                  <text x={(p1.x + p2.x) / 2} y={(p1.y + p2.y) / 2 - 5} textAnchor="middle" fontSize="9.5" className={hot ? "fill-brand-200 font-mono" : "fill-zinc-500 font-mono"}>
                    {e.label}
                  </text>
                )}
              </g>
            );
          })}
          {NODES.map((n) => {
            const s = KIND_STYLE[n.kind];
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
                className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-white"
                style={{ opacity: dim ? 0.55 : 1, transition: "opacity 150ms" }}
              >
                <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="9" fill={active ? "#1c1c1f" : "#141416"} stroke={active ? s.dot : s.stroke} strokeOpacity={active ? 1 : 0.55} strokeWidth={active ? 2 : 1} />
                <circle cx={n.x + 14} cy={n.y + 20} r="3.5" fill={s.dot} />
                <text x={n.x + 25} y={n.y + 24} fontSize="13" fontWeight="600" className="fill-zinc-100 font-mono">
                  {n.label}
                </text>
                <text x={n.x + 14} y={n.y + 42} fontSize="10" className="fill-zinc-500">
                  {n.sub}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <aside aria-live="polite" className="rounded-xl border border-white/[0.08] bg-ink-900 p-5">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-zinc-500">
          {node.kind === "module" ? `module · com.forge.${node.id}` : node.kind}
        </p>
        <h3 className="mt-1 font-mono text-lg font-semibold text-zinc-50">{node.label}</h3>
        <p className="mt-3 text-[13.5px] leading-relaxed text-zinc-300">{node.role}</p>
        <h4 className="mt-5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-zinc-500">Key classes</h4>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {node.classes.map((c) => (
            <li key={c} className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[11.5px] text-brand-200">
              {c}
            </li>
          ))}
        </ul>
        <h4 className="mt-5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-zinc-500">Patterns</h4>
        <ul className="mt-2 space-y-1">
          {node.patterns.map((p) => (
            <li key={p} className="text-[13px] text-zinc-400">
              {p}
            </li>
          ))}
        </ul>
        <div className="mt-6 border-t border-white/[0.06] pt-4">
          <p className="mb-2 text-[11px] text-zinc-500">Jump to</p>
          <div className="flex flex-wrap gap-1">
            {NODES.filter((n) => n.kind === "module").map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setSelected(n.id)}
                className={cx(
                  "rounded px-1.5 py-0.5 font-mono text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70",
                  n.id === selected ? "bg-brand-500/20 text-brand-200" : "text-zinc-400 hover:bg-white/[0.05]",
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
