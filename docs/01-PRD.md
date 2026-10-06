# 01 — Product Requirements Document (PRD)

## 1. Problem

Deploying an application today means a developer has to:

1. write a Dockerfile,
2. build an image,
3. push it to a registry,
4. provision a server or cluster,
5. run the container with the correct configuration and secrets,
6. put a reverse proxy and domain in front of it,
7. watch logs and health, and
8. roll back by hand when something breaks.

Platforms like Render, Railway, and Heroku reduce all of this to *"connect your repo, click Deploy."* **Forge** is a smaller, educational version of those platforms. It covers the same pipeline end to end, and its internals are designed to demonstrate OOP, SOLID, design patterns, LLD/HLD, and distributed-systems techniques.

## 2. Users and personas

| Persona | Description | Main goal |
|---------|-------------|-----------|
| **Developer (primary)** | A student or indie developer with a web app on GitHub | Get a live URL without learning DevOps |
| **Platform operator** | The Forge maintainer (us) | Keep builds healthy, observe the system, and scale the workers |

## 3. User stories

### M1 — "It deploys"

| ID | As a… | I want to… | So that… |
|----|-------|-----------|----------|
| US-1 | developer | register and log in with email and password | my projects are private to me |
| US-2 | developer | connect my GitHub account | Forge can read my repositories |
| US-3 | developer | create a project from one of my repos (branch, root directory, port, health path) | Forge knows what and how to deploy |
| US-4 | developer | set environment variables and secrets on a project | my app gets its configuration without me committing secrets |
| US-5 | developer | click **Deploy** | the latest commit is built and goes live |
| US-6 | developer | watch build logs live | I can see why a build fails |
| US-7 | developer | see deployment status (Queued → Building → Deploying → Live / Failed) | I know where my deploy is |
| US-8 | developer | open my app at `https://<project>.<forge-domain>` | I can share it |
| US-9 | developer | see runtime logs of my running app | I can debug production problems |
| US-10 | developer | have Forge auto-deploy on `git push` (webhook) | I don't have to click Deploy |
| US-11 | developer | keep the old version serving if a new deploy is unhealthy | a bad push never takes my site down |

### M2 — "It scales and survives failure"

| ID | As a… | I want to… | So that… |
|----|-------|-----------|----------|
| US-12 | developer | roll back to any previous successful deployment in one click | I can recover fast |
| US-13 | developer | get notified (email or Discord) when a deploy succeeds or fails | I don't have to watch the dashboard |
| US-14 | developer | see CPU, memory, and request metrics for my app | I understand its behaviour |
| US-15 | developer | have my app scale out automatically under load | it stays fast |
| US-16 | developer | get an AI-written explanation of why my deploy failed | I fix it faster |
| US-17 | operator | add more build workers without code changes | the queue drains faster under load |
| US-18 | operator | see queue depth, build duration, and failure rate in Grafana | I can operate the platform |
| US-19 | operator | know that a crashed worker never loses or duplicates a deployment | the system is reliable |

## 4. Functional requirements

| ID | Requirement | Milestone |
|----|-------------|-----------|
| FR-1 | Users register with email and password. Passwords are hashed with BCrypt. Auth uses JWT access tokens and rotating refresh tokens. | M1 |
| FR-2 | GitHub OAuth connection. The token is stored encrypted (AES-256-GCM). Forge can list the user's repos and branches. | M1 |
| FR-3 | Project CRUD: name, unique slug, repo, branch, root dir, build type (AUTO/DOCKERFILE/MAVEN/GRADLE/NODE), port, health-check path. | M1 |
| FR-4 | Environment variables are stored encrypted and injected into the container at runtime. They are never returned in plaintext after creation (masked). | M1 |
| FR-5 | A deployment request creates a `Deployment` in `QUEUED` and enqueues a build job. The API responds immediately with `202 Accepted`. | M1 |
| FR-6 | The build worker clones the repo at an exact commit SHA, detects the build type, produces a Docker image, and pushes it to the registry. | M1 |
| FR-7 | Build and runtime logs are persisted and streamed live to the browser (Server-Sent Events). | M1 |
| FR-8 | The deploy worker starts the new container, health-checks it, switches traffic, and stops the old container (blue-green). | M1 |
| FR-9 | Every deployment follows a strict **state machine**. Illegal transitions are rejected, and every transition is audited. | M1 |
| FR-10 | GitHub push webhooks, verified by HMAC-SHA256 signature and deduplicated by delivery ID, trigger deployments. | M1 |
| FR-11 | At most one deployment per project is in the build/deploy pipeline at a time. A newer request supersedes older queued ones. | M1 |
| FR-12 | Rollback re-deploys a previous image **without rebuilding**. | M2 |
| FR-13 | Build and deploy events flow through Kafka through a transactional outbox. Consumers are idempotent. | M2 |
| FR-14 | `POST /deployments` supports an `Idempotency-Key` header (Redis). | M2 |
| FR-15 | Calls to external dependencies (GitHub, registry, Docker/K8s API) use retries with backoff and circuit breakers. | M2 |
| FR-16 | A Kubernetes runtime provider uses a Deployment, Service, and Ingress, with rolling updates and an HPA. | M2 |
| FR-17 | Metrics are exposed for Prometheus, with Grafana dashboards for the platform and per app. | M2 |
| FR-18 | An AI failure investigator summarises the root cause from logs and suggests a fix. | M2 |
| FR-19 | Notifications on deployment success or failure. | M2 |

## 5. Non-functional requirements

| Category | Target |
|----------|--------|
| **Availability** | A failed deploy must never take down the currently live version (zero-downtime swap). |
| **Reliability** | A job is never lost when a worker crashes (lease plus re-queue). Duplicate delivery does not cause a duplicate deploy (idempotency). |
| **Scalability** | Build workers scale horizontally. Adding a worker requires zero code changes. |
| **Performance** | Deploy API p95 < 200 ms (the API only enqueues). Live log latency < 1 s. |
| **Security** | No plaintext secrets in the DB, in logs, or in git. JWT auth on every API. Ownership checks on every resource. Webhook HMAC verification. Builds run with CPU, memory, and time limits. |
| **Observability** | Every request and job log line carries a `correlationId` and `deploymentId`. Metrics cover the RED method (rate, errors, duration) and queue depth. |
| **Maintainability** | Module boundaries are enforced by tests (Spring Modulith / ArchUnit). ≥ 70 % line coverage on `domain` and `application` packages. |
| **Portability** | `docker compose up` starts the whole platform locally with one command. |

## 6. Out of scope (said explicitly, so the instructor sees the boundaries)

- Multi-region deployments and custom TLS certificates per user (we use one wildcard domain).
- Billing, teams, and organisations (single-owner projects only).
- Databases-as-a-service for user apps (users bring their own DB URL as an env var).
- Building arbitrary languages. We support **Dockerfile**, **Maven/Gradle (Java)**, and **Node** only.
- Strong multi-tenant isolation (gVisor or Firecracker). This is documented as a known limitation and future work.

## 7. Supported app types (so that the demo is predictable)

| Build type | Detected by | How Forge builds it |
|------------|-------------|---------------------|
| `DOCKERFILE` | `Dockerfile` in the root dir | `docker build` as-is |
| `MAVEN` | `pom.xml` | Generated multi-stage Dockerfile (Maven build → JRE 21 runtime) |
| `GRADLE` | `build.gradle(.kts)` | Generated multi-stage Dockerfile (Gradle build → JRE 21 runtime) |
| `NODE` | `package.json` | Generated Dockerfile (`npm ci` → `npm run build` → `npm start`) |

We will keep two sample repos (`sample-apps/hello-spring`, `sample-apps/hello-node`) for demos and tests.

## 8. Success criteria for the course

1. Live demo: push a commit to GitHub → the dashboard shows the build logs streaming → the app is live at its URL in under 2 minutes.
2. Live demo: push a broken commit → the deploy fails health checks → **the old version keeps serving** → the AI investigator explains the failure.
3. Live demo: kill a worker mid-build → the job is picked up by another worker and the deploy completes.
4. Every box in the architecture diagram can be explained, with *why* it exists and *what happens if it fails*.
