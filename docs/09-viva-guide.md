# 09 — Viva and Demo Guide

How to present Forge: the pitch, the end-to-end story, where each rubric item lives, every module in two sentences, likely questions, and the exact demo script.

## 1. The 60-second pitch

> "Forge is a small Render or Railway. You point it at a Git repository and click Deploy, or just `git push`. Forge clones that exact commit, detects whether it is a Spring Boot, Node or Dockerfile project, builds a container image, starts it in its own lightweight VM with Apple's container runtime, health-checks it, and only then moves traffic to it. A bad deploy never takes the site down: the old version keeps serving, and an **agent** reads the logs and tells you *why* it failed and how to fix it. It's Java 21 and Spring Boot, built as a **modular monolith** of 11 modules whose boundaries are enforced by tests. Slow work runs on a **Postgres job queue**, so the API answers in milliseconds and a crashed worker never loses a deployment."

## 2. End to end in 12 steps

Use the sequence diagrams in [04 §1](04-interactions.md#1-sequence-deploy-a-commit-uc5):

1. **Trigger.** The user clicks Deploy (`POST /api/v1/projects/{id}/deployments`), *or* GitHub sends a `push` webhook. `WebhookService` checks the HMAC-SHA256 signature in constant time and ignores a delivery ID it has already seen.
2. **Authenticate.** `JwtAuthenticationFilter` validates the access token. Projects are loaded by id *and* owner, so another user's project is a 404, not a 403.
3. **Pin the commit.** `SourceCodeProvider` resolves the branch to an exact 40-character SHA, so the deploy is reproducible.
4. **Record intent in one transaction.** `DeploymentService` saves `Deployment(QUEUED)` and enqueues a BUILD job in the *same* transaction. Older deployments still waiting are superseded.
5. **Return immediately:** `202 Accepted` with the deployment. The dashboard opens an SSE stream for live logs.
6. **Claim.** A `JobRunner` virtual thread claims the job with `FOR UPDATE SKIP LOCKED`, takes a lease and heartbeats it.
7. **Clone.** `JGitSourceCodeProvider` shallow-clones that SHA into a temporary folder that is always deleted.
8. **Detect and build.** `DetectorChain` picks the build type (Dockerfile → Maven → Gradle → Node). `BuildStrategyFactory` gives the strategy that writes a Dockerfile if needed. `AppleContainerImageBuilder` runs `container build`; the image stays in the engine's local store, so there is no registry and no push. Every log line goes through `LogSink` to the DB and the live stream.
9. **Queue the deploy.** Status becomes `DEPLOYING` and a DEPLOY job is enqueued.
10. **Start green.** `BlueGreenRollout` asks `RuntimeProvider` for a new container with decrypted env vars, memory and CPU limits and routing labels. `AppleContainerRuntimeProvider` runs it in its own VM, reads the VM's IP (192.168.64.x), and refreshes the routing table.
11. **Verify.** `HttpHealthProbe` polls the health path on the VM's IP every 2 s for up to 90 s, and fails fast if the container stops. Status is `HEALTH_CHECKING`. Meanwhile Traefik polls `GET /internal/routing` every second and adds green next to blue, behind its own health check.
12. **Switch or keep the old one.** Healthy → status `LIVE`, the old container is drained and stopped (and drops out of the routing table), the old deployment becomes `SUPERSEDED`. Unhealthy → the new container is removed, status `FAILED(UNHEALTHY)`, the old one never stopped serving, and after commit the agent writes an insight. Every transition is checked by the state machine and stored in `deployment_events`.

## 3. Where each rubric item is

| # | Rubric item | Document | Show in code |
|---|-------------|----------|--------------|
| 1 | Requirements, actors, use cases | [01](01-requirements.md) | — |
| 2 | Class diagram, relationships, multiplicity | [03 §1–4](03-class-design.md) | `Deployment`, `Project`, `EnvironmentVariable` |
| 3 | OOP | [03 §5](03-class-design.md#5-object-oriented-design) | `Deployment` (no setters), `AbstractJobHandler` |
| 4 | SOLID | [03 §6](03-class-design.md#6-solid--where-each-principle-is-applied) | `RetryingImageBuilder` (O), `LogSink`/`LogReader` (I), `RuntimeProvider` (D, L: the engine swap) |
| 5 | Design patterns | [03 §7](03-class-design.md#7-design-patterns-with-justification) | `DetectorChain`, `ContainerSpec.builder()`, `DeploymentStatus` |
| 6 | Sequence and activity diagrams | [04](04-interactions.md) | — |
| 7 | API and layer separation | [05](05-api-spec.md), [02 §3](02-architecture.md#3-modules-modular-monolith) | `DeploymentController` → `DeploymentService` |
| 8 | DB schema mapped from classes | [06](06-database-schema.md) | `db/migration/V1`–`V9` |
| 9 | Errors, validation, edge cases, concurrency | [07](07-error-handling.md), [03 §8](03-class-design.md#8-concurrency-design) | `GlobalExceptionHandler`, `PostgresJobQueue.claim` |
| 10 | Working implementation | Live demo (section 6) | 131 tests green, `ArchitectureTest` |

## 4. The modules in two sentences each

The presenter should be able to say this for each module, then open one class.

| Module | What it does | Open this class |
|--------|--------------|-----------------|
| `identity` | Registration, login, JWT access tokens (15 min) and rotating refresh tokens. Reusing an old refresh token is treated as theft and signs the user out everywhere. | `AuthService` |
| `project` | Projects, their build settings, and environment variables encrypted with AES-256-GCM and masked in every response. | `EnvironmentService` |
| `source` | Talks to Git: GitHub OAuth, listing repos, cloning a commit with JGit, and verifying push webhooks. | `WebhookService` |
| `build` | Turns source into an image: a chain of detectors picks the stack, a strategy writes the Dockerfile, Apple `container build` builds it (docker-java on the Docker engine). | `DefaultBuildService`, `AppleContainerImageBuilder` |
| `runtime` | Starts and stops app containers, each in its own lightweight VM with resource limits, and serves Traefik the routing table built from their labels (`GET /internal/routing`). `DockerRuntimeProvider` is the alternative for `forge.engine=docker`. | `AppleContainerRuntimeProvider`, `AppleRoutingTable` |
| `health` | Polls the app's health URL until it answers 2xx/3xx, times out, or the container dies. | `HttpHealthProbe` |
| `logs` | Stores build and runtime log lines with sequence numbers and streams them live over SSE, resuming from `Last-Event-ID`. | `LogBroadcaster` |
| `jobs` | A durable job queue on Postgres: `SKIP LOCKED` claiming, leases, heartbeat, reaper, exponential backoff, dead-lettering. | `PostgresJobQueue`, `JobRunner` |
| `deployment` | The heart: the state machine, the build and deploy job handlers, blue-green rollout, rollback and cancel. | `Deployment`, `BlueGreenRollout` |
| `notification` | Listens for status changes and emails the owner when a deploy goes live or fails. | `DeploymentNotifier` |
| `agent` | When a deploy fails, collects evidence (logs, failure detail such as an exit code where the engine reports one, config), redacts secrets, and diagnoses: Claude if a key is set, otherwise 13 rules. | `FailureInvestigator`, `DiagnosisRules` |
| `shared` | Error model (`ErrorCode`, ProblemDetail), encryption, correlation ids, `ContainerCli` (and the Docker client for the Docker engine). | `GlobalExceptionHandler` |

## 5. Likely questions

**Why a modular monolith and not microservices?**
One deployable is far cheaper to build, test and run, and the module boundaries are still real: `ArchitectureTest` fails the build if one module reaches into another's internals. A module that needs to scale on its own (the build workers) can be extracted later, because it already talks only through interfaces.

**Why not build inside the HTTP request?**
Builds take minutes. A request thread held that long breaks under load and is lost on restart. As a queued job it is durable, retryable and can run on any worker, and the API replies in milliseconds.

**Why a Postgres queue instead of Kafka or RabbitMQ?**
The job is inserted in the *same transaction* as the deployment, so they can never disagree (no dual-write problem), with no extra infrastructure. `SKIP LOCKED` makes concurrent claiming safe. Kafka is listed as future work: it adds fan-out and replay we don't need yet. `JobQueue` is an interface, so it would be a new adapter, not a rewrite.

**A worker crashes in the middle of a build. What happens?**
Its lease (`locked_until`) runs out because heartbeats stop. The reaper puts the job back to `PENDING`, another worker claims it, and the retry rebuilds the same SHA, giving the same image tag. `abandonedJobIsReclaimedAfterItsLeaseExpires` tests this.

**Exactly once?**
Not across systems. We do at-least-once delivery plus idempotency: webhook delivery ids are stored, jobs have unique idempotency keys, image tags come from the SHA, and the state machine rejects repeated transitions.

**How do you stop two deploys of the same project at once?**
In two layers. The deploy handler checks first and postpones the job (`JobPostponedException`) if another deploy is in progress. As the last line of defence, a partial unique index in Postgres allows only one in-progress deployment per project (`databaseAllowsOnlyOneInProgressDeploymentPerProject`).

**Optimistic or pessimistic locking?**
Both, where each fits. Optimistic (`@Version`) on `Deployment`, because conflicts are rare and we'd rather detect them and retry. Pessimistic row locks with `SKIP LOCKED` for claiming jobs, where contention is normal.

**How is it zero downtime?**
Blue-green: the new container must pass its health check before it gets traffic. During the swap the routing table lists both, Traefik load-balances across them, its retry middleware moves a failed connection to the other one, and an init process (`--init`) passes SIGTERM to the app so it finishes in-flight requests. Measured on Apple container: 402 requests under a request loop, 0 errors (earlier on Docker: 4 swaps, 1,340 requests, 0 errors).

**How are secrets stored?**
AES-256-GCM with a random 12-byte IV per value; GCM also detects tampering. The master key comes only from the environment. Values are masked in the API, decrypted only when the container starts, and redacted before logs reach the agent. Passwords are hashed with BCrypt (cost 12), not encrypted, because we never need them back.

**What makes it agentic?**
On failure the agent *observes* (the last build and runtime log lines, the failure reason and detail such as a crash or out-of-memory (Apple container reports no exit codes, so the logs carry the reason), build type, configured port, health path, commit), *reasons* (Claude, or 13 deterministic rules when there is no API key or the call fails), and *reports* a category, summary, suggested fix and confidence. It is a listener on `DeploymentStatusChanged`, so the pipeline doesn't know it exists.

**Isn't running users' code dangerous?**
Yes. Generated Dockerfiles run the app as a non-root user. On Apple container every app runs in its own lightweight VM, so apps don't share a kernel, with memory and CPU limits and all Linux capabilities dropped; builds have a 10-minute timeout. On the Docker engine (Linux) containers share the host kernel, so they get memory, CPU and process limits, `no-new-privileges` and a network that can't reach our database; microVMs (Firecracker) there are future work.

**Why Apple container instead of Docker?**
Three reasons. Each app runs in its own lightweight VM, which isolates apps more strongly than containers sharing one kernel. It is native on the Mac we demo on, with no Docker Desktop (which had crashed under memory pressure and corrupted its image store, see [D-004](DECISIONS.md)). And the swap proved the design: the pipeline depends only on the `ImageBuilder` and `RuntimeProvider` interfaces, so we added two adapters (`AppleContainerImageBuilder`, `AppleContainerRuntimeProvider`) and changed the wiring, with **zero changes** to the `deployment` module. That is Dependency Inversion and Liskov Substitution in practice. The one new piece is routing: Apple container has no Docker labels for Traefik to read, so Forge serves Traefik a routing table at `/internal/routing`. Docker stays as the alternative adapter (`forge.engine=docker`) for Linux and CI. Trade-offs: macOS 26+ on Apple silicon only, no exit codes, at least 200 MiB per container.

**What happens if a live app's container dies or the machine reboots?**
Forge heals it. `LiveInstanceWatcher` checks every 30 s that each LIVE deployment's container still runs; if one is gone it queues a `RECOVERY` deployment of the **same image**, which goes through the normal blue-green rollout and health check. Measured: a deleted container was serving again in 12 s, with no rebuild. It recovers each live deployment at most once (a broken image can't loop), and an engine error never counts as "gone". Recovery reuses the rollback path (`Deployment.recoveryOf` next to `rollbackTo`), so it needed no new pipeline code ([D-005](DECISIONS.md)).

**A release passes its health check but breaks real pages. What happens?**
With the project's rollout set to **Canary**, the new version only gets 20% of the traffic, then 50%, 15 s each. Traefik counts requests, 5xx responses and latency for each version separately (each version is its own service under a weighted one), and `CanaryAnalysis` compares the two over the same window, so an outage that hits both versions isn't blamed on the new one. If the new version is clearly worse, Forge sets its weight to 0 first (visitors are back on the old version within a second), removes it and fails the deployment with `CANARY_REGRESSION`; the agent explains it. Measured: a release with 30% failing pages was rolled back at 20%, and visitors saw 3 errors in 574 requests instead of 30% ([D-006](DECISIONS.md)).

**Where are the design patterns in that?**
`CanaryRollout` is a second `RolloutStrategy` next to `BlueGreenRollout` (Strategy); `RolloutSelector` picks one per deployment (rollbacks and first deploys always switch at once). Shared steps are in `RolloutSteps` (composition). `TrafficSplitter` and `TrafficMetrics` are ports in `runtime`, implemented by `AppleRoutingTable` and `TraefikMetrics` (adapters), so the deployment module never knows Traefik exists. The state machine got one state, `CANARY`.

**Replicas?**
1 to 3 per project. Each deployment starts one container per replica and all must be healthy; Traefik balances across them. If one dies, self-healing rolls out a fresh set while the others keep serving: 646 requests, 0 errors.

**Why does a wrong port fail in seconds, not after the 90 s timeout?**
During the health check `ListeningPortWatch` reads the new container's output. If the app announces only ports other than the project's (e.g. "listening on port 3000" when Forge routes to 8080), waiting can't help, so the check ends at once with that reason. The agent still produces its `PORT_MISMATCH` diagnosis. Wrong-port failures went from 102 s to 15 s.

**How would it scale?**
The API is stateless, so add instances behind a load balancer; `SKIP LOCKED` already lets many workers share one queue. Next: move SSE fan-out to Redis, extract the workers, move logs to object storage, and add a Kubernetes `RuntimeProvider` next to the Apple container and Docker ones. All are listed in [10](10-roadmap.md#future-work-presented-not-built).

## 6. Demo script (about 8 minutes)

**Before the session** (in this order):

```bash
container system start
brew services start postgresql@16
scripts/infra.sh up
```

```bash
scripts/demo-repos.sh
```

```bash
./mvnw -pl forge-server spring-boot:run
```

```bash
cd forge-dashboard && npm run dev
```

Open http://localhost:3000, sign in with the demo account, and create the project **hello-node** (repository owner `demo`, name `hello-node`, health path `/health`). Deploy it once so v1 is live at http://hello-node.localhost. In a second terminal, start the request loop:

```bash
while true; do curl -s -o /dev/null -w "%{http_code}\n" http://hello-node.localhost; sleep 0.2; done
```

**On stage:**

1. **Architecture** (1 min): the module diagram ([02 §3](02-architecture.md#3-modules-modular-monolith)) and the state machine ([03 §1](03-class-design.md#1-domain-model-entities-and-value-objects)).
2. **Push a new version** (2 min): run `scripts/demo-push.sh v2`. The dashboard shows a deploy triggered by the webhook, the pipeline stepper moves, and build logs stream live. The request loop never prints anything but `200`. Refresh the app: it says v2.
3. **A broken push** (2 min): run `scripts/demo-push.sh break-port`. The deploy fails `UNHEALTHY`, the site still serves v2, and the agent card says the app listens on the wrong port, with the fix.
4. **A crash** (1 min): run `scripts/demo-push.sh crash`. It fails within seconds, and the agent reports a missing `DATABASE_URL`.
5. **Rollback** (30 s): click Roll back on the v2 deployment. It goes live without rebuilding.
6. **Canary** (2 min): in the project's Settings choose **2 replicas** and **Canary**, save, run `scripts/demo-push.sh fix`. The stepper shows a Canary step with the live traffic split (20%, then 50%), and the log prints each step's numbers. Then run `scripts/demo-push.sh flaky` (30% of pages return 500 but `/health` is fine): it is rolled back at 20%, the site stays on the good version, and the agent says `CANARY_REGRESSION`.
7. **Proof** (1 min): show `ArchitectureTest` and the test run (131 green), and the `jobs` and `deployment_events` tables.
8. **Close** (30 s): future work (Kafka, Kubernetes, AWS, autoscaling).

Restore the app afterwards with `scripts/demo-push.sh fix`. Always have the **recorded backup video** of this script ready.
