# 09 — Viva and Demo Guide

How to present Forge: the pitch, the end-to-end story, where each rubric item lives, every module in two sentences, likely questions, and the exact demo script.

## 1. The 60-second pitch

> "Forge is a small Render or Railway. You point it at a Git repository and click Deploy, or just `git push`. Forge clones that exact commit, detects whether it is a Spring Boot, Node or Dockerfile project, builds a Docker image, starts it as a container, health-checks it, and only then moves traffic to it. A bad deploy never takes the site down: the old version keeps serving, and an **agent** reads the logs and tells you *why* it failed and how to fix it. It's Java 21 and Spring Boot, built as a **modular monolith** of 11 modules whose boundaries are enforced by tests. Slow work runs on a **Postgres job queue**, so the API answers in milliseconds and a crashed worker never loses a deployment."

## 2. End to end in 12 steps

Use the sequence diagrams in [04 §1](04-interactions.md#1-sequence-deploy-a-commit-uc5):

1. **Trigger.** The user clicks Deploy (`POST /api/v1/projects/{id}/deployments`), *or* GitHub sends a `push` webhook. `WebhookService` checks the HMAC-SHA256 signature in constant time and ignores a delivery ID it has already seen.
2. **Authenticate.** `JwtAuthenticationFilter` validates the access token. Projects are loaded by id *and* owner, so another user's project is a 404, not a 403.
3. **Pin the commit.** `SourceCodeProvider` resolves the branch to an exact 40-character SHA, so the deploy is reproducible.
4. **Record intent in one transaction.** `DeploymentService` saves `Deployment(QUEUED)` and enqueues a BUILD job in the *same* transaction. Older deployments still waiting are superseded.
5. **Return immediately:** `202 Accepted` with the deployment. The dashboard opens an SSE stream for live logs.
6. **Claim.** A `JobRunner` virtual thread claims the job with `FOR UPDATE SKIP LOCKED`, takes a lease and heartbeats it.
7. **Clone.** `JGitSourceCodeProvider` shallow-clones that SHA into a temporary folder that is always deleted.
8. **Detect and build.** `DetectorChain` picks the build type (Dockerfile → Maven → Gradle → Node). `BuildStrategyFactory` gives the strategy that writes a Dockerfile if needed. `DockerImageBuilder` builds and pushes the image to the local registry; every log line goes through `LogSink` to the DB and the live stream.
9. **Queue the deploy.** Status becomes `DEPLOYING` and a DEPLOY job is enqueued.
10. **Start green.** `BlueGreenRollout` asks `RuntimeProvider` for a new container with decrypted env vars, memory/CPU/process limits and Traefik routing labels.
11. **Verify.** `HttpHealthProbe` polls the health path every 2 s for up to 90 s, and fails fast if the container exits. Status is `HEALTH_CHECKING`.
12. **Switch or keep the old one.** Healthy → status `LIVE`, the old container is drained and stopped, the old deployment becomes `SUPERSEDED`. Unhealthy → the new container is removed, status `FAILED(UNHEALTHY)`, the old one never stopped serving, and after commit the agent writes an insight. Every transition is checked by the state machine and stored in `deployment_events`.

## 3. Where each rubric item is

| # | Rubric item | Document | Show in code |
|---|-------------|----------|--------------|
| 1 | Requirements, actors, use cases | [01](01-requirements.md) | — |
| 2 | Class diagram, relationships, multiplicity | [03 §1–4](03-class-design.md) | `Deployment`, `Project`, `EnvironmentVariable` |
| 3 | OOP | [03 §5](03-class-design.md#5-object-oriented-design) | `Deployment` (no setters), `AbstractJobHandler` |
| 4 | SOLID | [03 §6](03-class-design.md#6-solid--where-each-principle-is-applied) | `RetryingImageBuilder` (O), `LogSink`/`LogReader` (I), `RuntimeProvider` (D) |
| 5 | Design patterns | [03 §7](03-class-design.md#7-design-patterns-with-justification) | `DetectorChain`, `ContainerSpec.builder()`, `DeploymentStatus` |
| 6 | Sequence and activity diagrams | [04](04-interactions.md) | — |
| 7 | API and layer separation | [05](05-api-spec.md), [02 §3](02-architecture.md#3-modules-modular-monolith) | `DeploymentController` → `DeploymentService` |
| 8 | DB schema mapped from classes | [06](06-database-schema.md) | `db/migration/V1`–`V7` |
| 9 | Errors, validation, edge cases, concurrency | [07](07-error-handling.md), [03 §8](03-class-design.md#8-concurrency-design) | `GlobalExceptionHandler`, `PostgresJobQueue.claim` |
| 10 | Working implementation | Live demo (section 6) | 103 tests green, `ArchitectureTest` |

## 4. The modules in two sentences each

The presenter should be able to say this for each module, then open one class.

| Module | What it does | Open this class |
|--------|--------------|-----------------|
| `identity` | Registration, login, JWT access tokens (15 min) and rotating refresh tokens. Reusing an old refresh token is treated as theft and signs the user out everywhere. | `AuthService` |
| `project` | Projects, their build settings, and environment variables encrypted with AES-256-GCM and masked in every response. | `EnvironmentService` |
| `source` | Talks to Git: GitHub OAuth, listing repos, cloning a commit with JGit, and verifying push webhooks. | `WebhookService` |
| `build` | Turns source into an image: a chain of detectors picks the stack, a strategy writes the Dockerfile, docker-java builds and pushes. | `DefaultBuildService` |
| `runtime` | Starts and stops app containers with resource limits, an isolated network and Traefik routing labels. | `DockerRuntimeProvider` |
| `health` | Polls the app's health URL until it answers 2xx/3xx, times out, or the container dies. | `HttpHealthProbe` |
| `logs` | Stores build and runtime log lines with sequence numbers and streams them live over SSE, resuming from `Last-Event-ID`. | `LogBroadcaster` |
| `jobs` | A durable job queue on Postgres: `SKIP LOCKED` claiming, leases, heartbeat, reaper, exponential backoff, dead-lettering. | `PostgresJobQueue`, `JobRunner` |
| `deployment` | The heart: the state machine, the build and deploy job handlers, blue-green rollout, rollback and cancel. | `Deployment`, `BlueGreenRollout` |
| `notification` | Listens for status changes and emails the owner when a deploy goes live or fails. | `DeploymentNotifier` |
| `agent` | When a deploy fails, collects evidence (logs, exit code, config), redacts secrets, and diagnoses: Claude if a key is set, otherwise 12 rules. | `FailureInvestigator`, `DiagnosisRules` |
| `shared` | Error model (`ErrorCode`, ProblemDetail), encryption, correlation ids, the Docker client. | `GlobalExceptionHandler` |

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
Blue-green: the new container must pass its health check before it gets traffic. During the swap Traefik load-balances across both, its retry middleware moves a failed connection to the other one, and `tini` as PID 1 passes SIGTERM to the app so it finishes in-flight requests. Measured: 4 swaps under a request loop, 1,340 requests, 0 errors.

**How are secrets stored?**
AES-256-GCM with a random 12-byte IV per value; GCM also detects tampering. The master key comes only from the environment. Values are masked in the API, decrypted only when the container starts, and redacted before logs reach the agent. Passwords are hashed with BCrypt (cost 12), not encrypted, because we never need them back.

**What makes it agentic?**
On failure the agent *observes* (the last build and runtime log lines, the failure reason and detail such as exit code or out-of-memory, build type, configured port, health path, commit), *reasons* (Claude, or 12 deterministic rules when there is no API key or the call fails), and *reports* a category, summary, suggested fix and confidence. It is a listener on `DeploymentStatusChanged`, so the pipeline doesn't know it exists.

**Isn't running users' code dangerous?**
Yes. Generated Dockerfiles run the app as a non-root user, and every container gets memory, CPU and process limits, `no-new-privileges`, on a network that can't reach our database, and builds have a 10-minute timeout. Real platforms use microVMs (Firecracker); that's listed as future work.

**How would it scale?**
The API is stateless, so add instances behind a load balancer; `SKIP LOCKED` already lets many workers share one queue. Next: move SSE fan-out to Redis, extract the workers, move logs to object storage, and swap `DockerRuntimeProvider` for a Kubernetes one. All are listed in [10](10-roadmap.md#future-work-presented-not-built).

## 6. Demo script (about 8 minutes)

**Before the session** (in this order):

```bash
docker compose -f infra/docker-compose.yml up -d
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
6. **Proof** (1 min): show `ArchitectureTest` and the test run (103 green), and the `jobs` and `deployment_events` tables.
7. **Close** (30 s): future work (Kafka, Kubernetes, AWS, autoscaling).

Restore the app afterwards with `scripts/demo-push.sh fix`. Always have the **recorded backup video** of this script ready.
