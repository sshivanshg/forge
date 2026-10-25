# 02 — Architecture (High-Level Design)

## 1. System context

```mermaid
flowchart LR
    dev([Developer])
    visitor([Visitor])
    gh[(GitHub<br/>OAuth · repos · webhooks)]
    forge[[Forge]]
    llm[(Anthropic API<br/>optional)]
    mail[(SMTP / Mailpit)]

    dev -- "dashboard (HTTPS/JSON + SSE)" --> forge
    forge -- "OAuth, list repos, git clone" --> gh
    gh -- "signed push webhook" --> forge
    visitor -- "http://slug.localhost" --> forge
    forge -- "redacted failure context" --> llm
    forge -- "LIVE / FAILED email" --> mail
```

## 2. Containers (what runs)

```mermaid
flowchart TB
    subgraph Browser
        ui["forge-dashboard<br/>(Next.js, :3000)"]
    end
    subgraph Host["Docker host (laptop / server)"]
        subgraph CP["forge-server — Spring Boot control plane (:8080)"]
            api["REST API + SSE<br/>(controllers)"]
            svc["Application services<br/>(use cases)"]
            runner["JobRunner<br/>(virtual-thread workers)"]
            agent["Forge agent<br/>(FailureInvestigator)"]
        end
        pg[("PostgreSQL 16 :5433<br/>data · job queue · logs · audit")]
        reg[("registry:2 :5001<br/>images")]
        docker[["Docker Engine API"]]
        traefik["Traefik :80<br/>reverse proxy"]
        mailpit["Mailpit :8025"]
        subgraph Apps["network forge-apps"]
            blue["app container (blue, live)"]
            green["app container (green, new)"]
        end
    end
    gh[(GitHub)]

    ui -->|JSON / SSE| api --> svc
    svc -->|JPA / JDBC| pg
    runner -->|"claim: FOR UPDATE SKIP LOCKED"| pg
    runner -->|JGit clone| gh
    runner -->|"docker-java: build · push · run · stop"| docker
    docker --> reg
    docker -.creates.-> blue & green
    traefik -->|"Host(slug.localhost)"| blue & green
    runner -->|"health probe 127.0.0.1:port"| green
    svc --> mailpit
    gh -->|webhook| api
```

**Control plane vs data plane.** `forge-server` decides *what* should run and records it in Postgres. Docker and Traefik actually run and route the apps. Visitor traffic never passes through `forge-server`, so restarting Forge doesn't take any app down.

## 3. Modules (modular monolith)

`forge-server` is one deployable split into **11 modules** (top-level packages under `com.forge`). A module may use another module **only through the types in that module's root package** (its public API). Everything in sub-packages (`api`, `application`, `domain`, `infrastructure`) is internal. `ArchitectureTest` enforces this with Spring Modulith and fails the build on any violation.

```mermaid
flowchart LR
    identity["identity<br/>users · JWT"]
    project["project<br/>projects · env vars"]
    source["source<br/>GitHub · git · webhooks"]
    build["build<br/>detect · Dockerfile · image"]
    runtime["runtime<br/>containers (Docker)"]
    health["health<br/>HTTP probe"]
    logs["logs<br/>store · live stream"]
    jobs["jobs<br/>queue · workers"]
    deployment["deployment<br/>state machine · pipeline"]
    notification["notification<br/>email"]
    agent["agent<br/>failure investigator"]
    shared["shared (open)<br/>errors · crypto · web · docker client"]

    project --> build
    build --> source & logs
    deployment --> project & source & build & runtime & health & logs & jobs
    notification --> deployment & project & identity
    agent --> deployment & project & logs
```

The graph has **no cycles**: dependencies point from orchestration (`deployment`) down to capabilities (`build`, `runtime`, `logs` …). Modules that only need to *react* (`notification`, `agent`) listen to the `DeploymentStatusChanged` event, so `deployment` does not know they exist.

| Module | Public API (root package) | Owns tables |
|--------|---------------------------|-------------|
| identity | `UserLookup`, `UserSummary` | users, refresh_tokens |
| project | `ProjectCatalog`, `ProjectSnapshot`, `ProjectDeleting` | projects, environment_variables |
| source | `SourceCodeProvider`, `GitHubAccounts`, `GitRepository`, `CommitInfo`, `GitPushReceived` | github_connections, webhook_deliveries |
| build | `BuildService`, `BuildRequest`, `BuildResult`, `BuildType`, `BuildFailedException` | — |
| runtime | `RuntimeProvider`, `ContainerSpec`, `RunningInstance` | — |
| health | `HealthProbe`, `HealthResult` | — |
| logs | `LogSink`, `LogReader`, `LogStreams`, `LogLine`, `LogSource` | log_lines |
| jobs | `JobQueue`, `JobHandler`, `AbstractJobHandler`, `Job`, `JobType`, `JobPayload`, `JobPostponedException` | jobs |
| deployment | `DeploymentStatus`, `DeploymentStatusChanged`, `DeploymentQueries`, `DeploymentView`, `FailureReason`, `DeploymentTrigger` | deployments, deployment_events, runtime_instances |
| notification | — (listener only) | — |
| agent | — (listener + its own API) | deployment_insights |

### Layers inside a module

```
api            → controllers + request/response records (HTTP only)
application    → use-case services, @Transactional boundaries, event listeners
domain         → entities, value objects, domain rules (no web, no Docker, no JGit)
infrastructure → adapters: Spring Data repositories, docker-java, JGit, HTTP clients
```

`api → application → domain ← infrastructure`. ArchitectureTest checks that the domain never depends on web or adapter code, that controllers never touch repositories, and that only adapters import Docker or JGit.

## 4. The deployment pipeline at a glance

```mermaid
flowchart LR
    A[POST /deployments<br/>or git push] --> B[(QUEUED<br/>+ BUILD job)]
    B -->|worker claims| C[BUILDING<br/>clone → detect → docker build → push]
    C -->|image ready<br/>+ DEPLOY job| D[DEPLOYING<br/>start green container]
    D --> E[HEALTH_CHECKING<br/>poll /health]
    E -->|healthy| F[LIVE<br/>stop blue]
    E -->|unhealthy| G[FAILED<br/>remove green, blue keeps serving]
    C -->|build error| G
    G --> H[🤖 agent diagnosis]
```

Two jobs (BUILD, then DEPLOY) instead of one means a rollback can skip the BUILD job, and a crash during deploy doesn't redo a 3-minute build.

## 5. Why these technologies (decision log)

| # | Decision | Reason | Trade-off accepted |
|---|----------|--------|--------------------|
| 1 | **Modular monolith** | One deployable is simple to run, debug and demo. Boundaries are still enforced by tests, so a module could be extracted later. | Modules cannot be scaled independently |
| 2 | **Postgres as the job queue** | Enqueue happens in the **same transaction** as the deployment insert (no dual-write problem). `SKIP LOCKED` gives safe concurrent workers. No extra infrastructure. | Polling. Throughput is bounded by one DB (fine for this scale; Kafka is future work). |
| 3 | **Java 21 virtual threads** | Builds and health checks are I/O-bound. Virtual threads give one thread per job without a reactive rewrite. | — |
| 4 | **docker-java** over shelling out to the `docker` CLI | Typed API, streaming output, testable behind `RuntimeProvider` and `ImageBuilder` interfaces | Library learning curve |
| 5 | **JGit** | Pure Java, so no git binary in the server image. Shallow clone of an exact commit. | Slower than native git on huge repos |
| 6 | **Traefik** | Discovers containers from Docker labels, so Forge never writes proxy config files. Built-in health checks. | One more component |
| 7 | **Server-Sent Events** for logs | One-way server→browser stream over plain HTTP, with auto-reconnect and resume (`Last-Event-ID`) built into browsers | One-way only (all we need) |
| 8 | **Flyway** | Schema versioned in git and identical everywhere. Hibernate only validates. | Applied migrations must never be edited |
| 9 | **JWT + rotating refresh tokens** | Stateless API (any instance can verify). Refresh rotation limits stolen-token damage. | Access tokens can't be revoked before their 15-minute expiry |
| 10 | **Rules first, LLM optional** for the agent | Works offline and deterministically in the demo. The LLM improves answers when available, and any LLM error falls back to rules. | Rules only know the failure patterns we wrote down |
| 11 | **Spring Boot 3.5 (not 4.x)** | Matches the locked course scope and the mature ecosystem (springdoc, Modulith 1.4) | Boot 3.5 is near the end of its open-source support window |

## 6. Security architecture

| Threat | Mitigation | Code |
|--------|------------|------|
| Password database leak | BCrypt cost 12 | `SecurityConfig.passwordEncoder` |
| Stolen refresh token | Stored as SHA-256 only. Rotated on every use. Replaying a used token revokes **all** sessions of that user. | `AuthService.refresh` |
| Account enumeration | Same 401 message, and the same BCrypt timing, for unknown email and wrong password | `AuthService.login` (dummy hash) |
| Reading another user's data | Ownership is part of every query. Answers 404, never 403. | `ProjectRepository.findOwned`, `DeploymentQueryService.getOwned` |
| Secrets in the database | AES-256-GCM (random IV, tamper detection). The key comes only from the environment. | `EncryptionService` |
| Forged webhooks | HMAC-SHA256 with constant-time compare, plus delivery-id de-duplication | `WebhookService.verifySignature` |
| OAuth CSRF | Single-use, 10-minute `state` | `OAuthStateStore` |
| Secrets leaking to the LLM | Env-var values are redacted from logs before the agent reads them | `SecretRedactor` |
| Malicious user code | Memory and CPU limits, 256-process limit, `no-new-privileges`, a separate network from the DB, a build timeout. *Known limit: not VM-level isolation.* | `DockerRuntimeProvider` |
| Path traversal via repo settings | `rootDir`, `repoName` and `slug` are validated in value objects. The context dir must stay inside the workspace. | `BuildSettings`, `RepoRef`, `DefaultBuildService` |

## 7. Failure modes

| What fails | User impact | Why the system stays correct |
|------------|-------------|------------------------------|
| Worker crashes mid-build | Deployment takes longer | The lease expires, the reaper re-queues, and the job retries (`BUILDING` is accepted on retry). Same commit gives the same image tag. |
| New version crashes or listens on the wrong port | `FAILED (UNHEALTHY)` + diagnosis | Green is removed. Blue is never touched. |
| Docker daemon briefly unavailable | Slower deploy | `ExternalServiceException` is retryable: backoff 10 s → 20 s → 40 s, then dead-lettered → FAILED |
| Two deploys of one project at once | Second one waits | Postponed via `JobPostponedException`, and the partial unique index is the last line of defence |
| GitHub retries a webhook | Nothing | `webhook_deliveries` primary key |
| User cancels during a build | Build finishes, then the image is discarded | `completeBuild` sees `CANCELLED` and does nothing |
| forge-server restarts | Dashboard reconnects | State is in Postgres. Apps keep running (control plane ≠ data plane). |
| Mail server down | No email | Notifications are async and after commit, and a failure is only logged |
| LLM API down or slow | Diagnosis comes from rules | `ClaudeDiagnosisEngine` returns empty on any error |

## 8. How it would scale (future work, not built)

| Bottleneck | Next step |
|------------|-----------|
| One Postgres as the queue | Kafka topic per job type, transactional outbox, idempotent consumers |
| Live logs held in one JVM's memory | Redis pub/sub so any API replica can serve any stream |
| Builds compete with the API for CPU | Extract `jobs` + `build` + `deployment` handlers into a separate `forge-worker` deployable (module boundaries already allow it) |
| A single Docker host | A Kubernetes `RuntimeProvider` (Deployment + Service + Ingress, rolling update, HPA). The pipeline code stays unchanged. |
| Container isolation | gVisor or Firecracker microVMs for untrusted builds |
