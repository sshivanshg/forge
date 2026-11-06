# 05 — API and Interface Design

> Rubric item 7: method signatures, request and response structures, and separation between layers. Live, always-current docs are at **`http://localhost:8080/swagger-ui.html`** (springdoc generates them from the code).

## 1. Layering of every request

```mermaid
flowchart LR
    http[HTTP request] --> filters["Filters<br/>CorrelationIdFilter → JwtAuthenticationFilter"]
    filters --> ctrl["Controller (api)<br/>@Valid request record"]
    ctrl --> svc["Service (application)<br/>@Transactional use case<br/>ownership check"]
    svc --> dom["Domain<br/>entity methods enforce invariants"]
    svc --> repo["Repository (infrastructure)<br/>Spring Data / JDBC"]
    repo --> pg[(PostgreSQL)]
    ctrl -. "exceptions" .-> geh["GlobalExceptionHandler<br/>→ RFC 9457 ProblemDetail"]
```

| Layer | Allowed to | Not allowed to |
|-------|------------|----------------|
| Controller (`api`) | Parse and validate input, call **one** service method, map to a response record | Business rules, repositories (checked by ArchitectureTest), try/catch |
| Service (`application`) | Use cases, transactions, ownership, calling other modules' public APIs | HTTP types (`HttpServletRequest`), SQL |
| Domain (`domain`) | Invariants, state transitions, value validation | Spring Web, docker-java, JGit (checked by ArchitectureTest), the container engine |
| Repository / adapter (`infrastructure`) | SQL, the container engine (Apple `container` or Docker), Git, HTTP clients | Business decisions |

## 2. Conventions

- Base path `/api/v1`. JSON everywhere. Server-Sent Events for streams.
- Auth header `Authorization: Bearer <accessToken>`. SSE endpoints (paths ending in `/stream`) also accept `?access_token=` because browsers' `EventSource` cannot send headers.
- Async operations answer **202 Accepted** with a `Location` header.
- Collections: `?page=0&size=20` (size 1–100) → `{content, page, size, totalElements, totalPages}`.
- Every response carries `X-Correlation-Id`.

### Error format (RFC 9457 Problem Details), always the same shape

```json
{
  "type": "https://forge.dev/errors/not-cancellable",
  "title": "Deployment can no longer be cancelled",
  "status": 409,
  "detail": "Deployment is HEALTH_CHECKING and can no longer be cancelled",
  "instance": "/api/v1/deployments/7f3c…/cancel",
  "code": "NOT_CANCELLABLE",
  "correlationId": "c0a8012e-…"
}
```

Validation errors add `"errors": [{"field": "password", "message": "must be 10 to 100 characters"}]`. The codes are listed in `ErrorCode.java` and in [07](07-error-handling.md).

## 3. Endpoints

### Auth (`identity.api.AuthController`)

| Method & path | Request | Response |
|---------------|---------|----------|
| `POST /auth/register` | `{email, password (10–100), displayName}` | `201 {id, email, displayName}` · `409 EMAIL_TAKEN` |
| `POST /auth/login` | `{email, password}` | `200 {accessToken, refreshToken, expiresIn}` · `401 INVALID_CREDENTIALS` |
| `POST /auth/refresh` | `{refreshToken}` | `200` new pair (the old one is revoked) · `401 INVALID_TOKEN` (replay revokes all sessions) |
| `POST /auth/logout` | `{refreshToken}` | `204` |
| `GET /me` | — | `200 {id, email, displayName}` |

### GitHub (`source.api`)

| Method & path | Response |
|---------------|----------|
| `GET /github/connection` | `{connected, login, oauthConfigured}` |
| `POST /github/connect` | `{authorizeUrl}` · `503 GITHUB_OAUTH_NOT_CONFIGURED` |
| `GET /github/callback?code&state` | `302` → `{dashboard}/settings?github=connected\|error` (public, the state identifies the user) |
| `DELETE /github/connection` | `204` |
| `GET /github/repos` | `[{owner, name, fullName, defaultBranch, isPrivate}]` · `422 GITHUB_NOT_CONNECTED` |
| `GET /github/repos/{owner}/{name}/branches` | `["main", …]` |
| `POST /webhooks/github` | Public. Headers `X-GitHub-Event`, `X-GitHub-Delivery`, `X-Hub-Signature-256`. → `202 {"result":"accepted"\|"duplicate"\|"ignored"}` · `401 INVALID_WEBHOOK_SIGNATURE` |

### Projects (`project.api`)

| Method & path | Request | Response |
|---------------|---------|----------|
| `POST /projects` | `{name, slug?, repoOwner, repoName, branch?, rootDir?, buildType?, port?, healthCheckPath?, autoDeploy?}` | `201 Project` · `409 SLUG_TAKEN` · `400 VALIDATION_FAILED` |
| `GET /projects` | page params | `Page<Project>` (only your own) |
| `GET /projects/{id}` | — | `Project` · `404` if missing **or not yours** |
| `PATCH /projects/{id}` | any create field except `slug`, plus `replicas` (1–3) and `rollout` (`BLUE_GREEN` \| `CANARY`); null = unchanged | `Project` |
| `DELETE /projects/{id}` | — | `204` (containers are stopped first) |
| `GET /projects/{id}/env` | — | `[{key, valuePreview, updatedAt}]` (masked: `po••••••`) |
| `PUT /projects/{id}/env` | `{vars: {KEY: "value"}}` (upsert) | `204` + `X-Forge-Redeploy-Required: true` |
| `DELETE /projects/{id}/env/{key}` | — | `204` |

`Project = {id, name, slug, repoOwner, repoName, repoUrl, branch, rootDir, buildType, port, healthCheckPath, autoDeploy, replicas, rollout, liveUrl, liveDeploymentId, createdAt, updatedAt}`

`replicas` (1–3, default 1) is how many instances each deployment runs behind the proxy; `rollout` (`BLUE_GREEN` default, or `CANARY`) is how a new version takes over traffic. Both are set with `PATCH` only.

### Deployments (`deployment.api.DeploymentController`)

| Method & path | Request | Response |
|---------------|---------|----------|
| `POST /projects/{id}/deployments` | optional `{commitSha}` (40 hex) | `202 Deployment` (QUEUED) · `422 REPOSITORY_UNREACHABLE` |
| `GET /projects/{id}/deployments` | page params | `Page<Deployment>` (newest first) |
| `GET /deployments/{id}` | — | `Deployment` with `timeline` |
| `POST /deployments/{id}/cancel` | — | `202 Deployment` · `409 NOT_CANCELLABLE` |
| `POST /deployments/{id}/rollback` | — | `202` new `Deployment` · `422 NOT_ROLLBACKABLE` |
| `GET /deployments/{id}/logs?after=0&limit=500` | — | `[{seq, source, line, ts}]` |
| `GET /deployments/{id}/logs/stream` | `Last-Event-ID` header (auto on reconnect) | SSE: `log` (id = seq), `status`, `done` |
| `GET /projects/{id}/runtime-logs/stream` | — | SSE `log {line, ts}` from the live container |
| `GET /deployments/{id}/insight` | — | Agent diagnosis, or `404` until ready |

```json
// Deployment
{
  "id": "7f3c…", "projectId": "2b1e…",
  "commitSha": "3f2a9c1b0d4e5f60718293a4b5c6d7e8f9012345", "commitMessage": "feat: say hello",
  "trigger": "WEBHOOK", "status": "FAILED", "trafficPercent": null, "failureReason": "UNHEALTHY",
  "failureDetail": "process exited (ConnectException); container process exited (see the app's last log lines)",
  "imageRef": "forge/hello-node:3f2a9c1b0d4e", "rollbackOfId": null,
  "createdAt": "…", "startedAt": "…", "finishedAt": "…",
  "timeline": [ {"from": null, "to": "QUEUED", "message": "Deployment queued", "at": "…"}, … ]
}

// Insight
{
  "deploymentId": "7f3c…", "category": "PORT_MISMATCH",
  "summary": "The app listens on port 3000 but the project expects port 8080, so health checks could not reach it.",
  "suggestedFix": "Either change the project's port to 3000 in Settings, or make the app read the PORT environment variable (Forge sets PORT=8080).",
  "confidence": "HIGH", "engine": "rules",
  "evidence": ["Server listening on port 3000"], "createdAt": "…"
}
```

`trafficPercent` is the new version's share of the traffic (0–100) while the deployment is `CANARY`, and `null` in every other status.

### Dashboard insights (`deployment.api.InsightsController`)

Read-only; all scoped to the caller's own projects (`404` for anyone else's, like the endpoints above).

| Method & path | Request | Response |
|---------------|---------|----------|
| `GET /deployments/{id}/traffic` | — | `Traffic` · `404` |
| `GET /projects/{id}/instances` | — | `[Instance]` · `404` |
| `GET /activity?limit=20` | `limit` 1–100 (out-of-range values are clamped) | `[ActivityItem]`, newest first, across all your projects |
| `GET /overview` | — | `Overview` |

```json
// Traffic: cumulative proxy counters for this version since Traefik started (zeros if metrics are unavailable)
{ "deploymentId": "7f3c…", "requests": 1200, "serverErrors": 6, "errorRate": 0.005,
  "meanLatencyMs": 12.4, "sampledAt": "…" }

// Instance: one per replica container that is not stopped
{ "id": "a91d…", "deploymentId": "7f3c…", "replicaIndex": 0, "containerId": "forge-hello-node-7f3c…-0",
  "address": "http://192.168.64.12:8080", "state": "RUNNING", "startedAt": "…", "trafficWeight": 100 }

// ActivityItem: a Deployment (without timeline) plus its project's name and slug
{ "id": "7f3c…", "projectId": "2b1e…", "status": "LIVE", "…": "…", "timeline": null,
  "projectName": "Hello Node", "projectSlug": "hello-node" }

// Overview
{ "projects": 3, "liveProjects": 2, "deploys7d": 9, "failed7d": 2, "successRate7d": 0.78,
  "medianDeployMs7d": 41250,
  "deploysByDay": [ {"date": "2026-10-24", "succeeded": 0, "failed": 0}, …14 days, oldest first… ] }
```

- **Instance**: `state` is the container's bookkeeping status (`STARTING` or `RUNNING`) from `runtime_instances`; `address` is the internal URL the proxy and health probe use; `startedAt` is when the container was created. `trafficWeight` (0–100) is the share of the project's route its version receives: during a canary the canary's `trafficPercent` and the rest split over the other versions, otherwise an equal share per running version (Traefik's default).
- **Overview**: "succeeded" means the deployment reached `LIVE` (now `LIVE`, `SUPERSEDED` or `STOPPED`). `deploys7d` counts every deployment created in the last 7 days (any status); `successRate7d` = succeeded / (succeeded + failed), `null` with none finished; `medianDeployMs7d` is the median `finishedAt − startedAt` of the succeeded ones, `null` with none. `deploysByDay` covers the last 14 UTC days, zero-filled.

### SSE stream example

```
event: log
id: 42
data: {"seq":42,"source":"BUILD","line":"Step 4/9 : RUN npm ci","ts":"…"}

event: status
data: {"status":"HEALTH_CHECKING","failureReason":null}

event: done
data: {"status":"LIVE"}
```

### Infrastructure (`runtime.api.RoutingController`)

This endpoint is for Traefik, not for people. It is outside `/api/v1`, takes no user JWT, and is protected by a shared token instead (`forge.runtime.routing-token`, from `FORGE_ROUTING_TOKEN`; `scripts/infra.sh up` generates it and passes it to Traefik).

| Method & path | Request | Response |
|---------------|---------|----------|
| `GET /internal/routing` | Header `X-Forge-Routing-Token: <token>` | `200` Traefik dynamic configuration (JSON) · `401` (empty body) if the header is missing or wrong · `404` on the Docker engine, where Traefik reads Docker labels instead |

Traefik's HTTP provider polls it every second. The table is built by `AppleRoutingTable` from the labels on the running app containers: one router, one service and one retry middleware per project, with every running instance (blue and green during a swap) as a server on its VM IP. With no running apps the body is `{}`.

```json
{
  "http": {
    "routers": {
      "hello-node": { "rule": "Host(`hello-node.localhost`)", "entryPoints": ["web"],
                      "service": "hello-node", "middlewares": ["hello-node-retry"] }
    },
    "services": {
      "hello-node": { "loadBalancer": {
        "healthCheck": { "path": "/health", "interval": "2s", "timeout": "2s" },
        "servers": [ { "url": "http://192.168.64.5:8080" } ] } }
    },
    "middlewares": {
      "hello-node-retry": { "retry": { "attempts": 5, "initialInterval": "200ms" } }
    }
  }
}
```

## 4. Internal interfaces between modules (Java signatures)

These are the "API" one module offers another (root-package types, see [02 §3](02-architecture.md#3-modules-modular-monolith)).

```java
// project
public interface ProjectCatalog {
  ProjectSnapshot getOwned(UUID projectId, UUID ownerId);      // NotFoundException if not owner
  ProjectSnapshot get(UUID projectId);
  List<ProjectSnapshot> findAutoDeployTargets(String owner, String repo, String branch);
  Map<String, String> environmentOf(UUID projectId);           // decrypted, only for container start
  void recordLiveDeployment(UUID projectId, UUID deploymentId);
}

// source
public interface SourceCodeProvider {
  String resolveHead(GitRepository repo, String branch, Optional<String> token);
  CommitInfo checkout(GitRepository repo, String branch, String sha, Path dir, Optional<String> token);
}

// build
public interface BuildService { BuildResult build(BuildRequest request); }   // throws BuildFailedException

// runtime
public interface RuntimeProvider {
  RunningInstance start(ContainerSpec spec);
  void promote(String instanceId);
  void stop(String instanceId);                                 // idempotent
  boolean isRunning(String instanceId);
  String exitDescription(String instanceId);
  List<String> recentOutput(String instanceId, int lines);
  Closeable followOutput(String instanceId, int tail, Consumer<String> lines);
}

// health
public interface HealthProbe {
  HealthResult awaitHealthy(URI baseUrl, String path, Duration timeout, BooleanSupplier stillAlive);
}

// jobs
public interface JobQueue { void enqueue(JobType type, Object payload, String idempotencyKey); }
public interface JobHandler {
  JobType type(); void handle(Job job); boolean isRetryable(Throwable e); void onExhausted(Job job, Throwable e);
}

// logs
public interface LogSink    { void append(UUID deploymentId, LogSource source, String text); }
public interface LogReader  { List<LogLine> after(UUID id, int afterSeq, int limit); List<LogLine> tail(UUID id, int n); }
public interface LogStreams { SseEmitter subscribe(UUID id, int afterSeq); void publishStatus(UUID id, String status, String reason, boolean terminal); }

// deployment
public interface DeploymentQueries { DeploymentView get(UUID id); DeploymentView getOwned(UUID id, UUID userId); }
public record DeploymentStatusChanged(UUID deploymentId, UUID projectId, DeploymentStatus from,
    DeploymentStatus to, FailureReason failureReason, String message, Instant occurredAt) {}
```

## 5. HTTP status codes used

| Code | Meaning in Forge |
|------|------------------|
| 200 / 201 / 204 | OK / created / no body |
| 202 | Accepted for asynchronous processing (deploy, cancel, rollback, webhook) |
| 302 | OAuth callback redirect |
| 400 | Validation failed (shape or domain rule) |
| 401 | Missing or invalid token, bad credentials, bad webhook signature, missing or wrong routing token |
| 404 | Not found **or not yours** |
| 409 | Conflict: email or slug taken, not cancellable, illegal transition, concurrent update |
| 422 | Semantically impossible: repo unreachable, nothing to roll back to, GitHub not connected |
| 502 / 503 | External dependency failed, or the feature is not configured |
