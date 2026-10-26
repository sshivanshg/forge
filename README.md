# Forge — Cloud Application Deployment Platform

> A Render/Railway-style platform that builds, containerizes, deploys and monitors applications from Git repositories, with an **agent** that diagnoses failed deployments. Built with Java 21 and Spring Boot.

**Problem statement:** Design and Development of a Scalable Cloud-Native Application Deployment and Orchestration Platform.

```
git push ─► webhook ─► job queue ─► clone ─► detect ─► docker build ─► registry ─► start green ─► health check ─► switch traffic ─► LIVE
                                                                                                         └─ unhealthy ─► keep blue ─► agent diagnosis
```

## What it does

- Deploy a repository with one click or on every `git push` (HMAC-verified webhooks)
- Detects Dockerfile, Maven, Gradle and Node projects and writes the Dockerfile for you
- **Blue-green deploys with zero downtime**; a failed version never replaces a working one
- One-click **rollback** without rebuilding
- Live build and runtime logs in the browser (Server-Sent Events, resumable)
- Encrypted environment variables (AES-256-GCM), masked in the API
- **Forge Agent**: reads the evidence of a failed deploy and explains the cause and the fix (Claude, or 12 built-in rules offline)
- Email notifications when a deploy goes live or fails

## Quick start

Prerequisites: Java 21, Docker Desktop, Node 22.

```bash
cp .env.example .env
```

Fill in `FORGE_ENCRYPTION_KEY` and `FORGE_JWT_SECRET` (each from `openssl rand -base64 32`), then:

```bash
docker compose -f infra/docker-compose.yml up -d
```

```bash
./mvnw -pl forge-server spring-boot:run
```

```bash
cd forge-dashboard && npm install && npm run dev
```

| URL | What |
|-----|------|
| http://localhost:3000 | Dashboard |
| http://localhost:8080/swagger-ui.html | API docs |
| http://&lt;project-slug&gt;.localhost | Deployed apps (via Traefik) |
| http://localhost:8090 | Traefik dashboard |
| http://localhost:8025 | Notification emails (Mailpit) |

To demo without GitHub, run `scripts/demo-repos.sh` and follow [the demo script](docs/09-viva-guide.md#6-demo-script-about-8-minutes).

Run all tests (unit, Testcontainers integration, architecture, coverage gate):

```bash
./mvnw verify
```

## Design documents

| # | Document | Rubric item |
|---|----------|-------------|
| 01 | [Requirements](docs/01-requirements.md) | Functional and non-functional requirements, actors, use cases |
| 02 | [Architecture](docs/02-architecture.md) | Modules, layers, technology decisions, security, failure modes |
| 03 | [Class design](docs/03-class-design.md) | Class diagrams, OOP, SOLID, design patterns, concurrency |
| 04 | [Sequence and activity diagrams](docs/04-interactions.md) | Deploy, agent, webhook, login, rollback flows |
| 05 | [API and interfaces](docs/05-api-spec.md) | REST endpoints, error format, module interfaces |
| 06 | [Database schema](docs/06-database-schema.md) | ER diagram, class → table mapping, constraints, indexes |
| 07 | [Error handling](docs/07-error-handling.md) | Error model, validation, edge cases, concurrency |
| 08 | [Engineering standards](docs/08-engineering-standards.md) | Code style, architecture tests, testing, CI |
| 09 | [Viva and demo guide](docs/09-viva-guide.md) | Pitch, module walkthrough, Q&A, demo script |
| 10 | [Build plan](docs/10-roadmap.md) | Day plan to the evaluation, future work |
| — | [Decision log](docs/DECISIONS.md) | Scope decisions, newest first |

## Stack

| Area | Choice |
|------|--------|
| Language | **Java 21** (records, sealed types, virtual threads). The dashboard is the only non-Java code. |
| Framework | Spring Boot 3.5 (Web, Security, Data JPA, Validation, Actuator, Mail), Spring Modulith |
| Database | PostgreSQL 16 + Flyway; also the job queue (`FOR UPDATE SKIP LOCKED`) |
| Containers | Docker via docker-java; local registry; Traefik v3 for routing |
| Git | JGit; GitHub OAuth and webhooks |
| Agent | Anthropic Messages API (optional) with a rule-based fallback |
| Frontend | Next.js 16 + Tailwind |
| Testing | JUnit 5, AssertJ, Mockito, Testcontainers, ArchUnit, WireMock, JaCoCo |
| Architecture | Modular monolith, 11 modules, ports and adapters |

Future work (not built for this milestone): Kafka with a transactional outbox, Redis, Kubernetes, AWS, autoscaling, Prometheus/Grafana. See [D-003](docs/DECISIONS.md).

## Repository layout

```
forge-server/      Spring Boot control plane (11 modules under com.forge)
forge-dashboard/   Next.js dashboard
infra/             docker-compose: Postgres, registry, Traefik, Mailpit
sample-apps/       hello-node and hello-spring, used for demos and tests
scripts/           offline demo: local Git repos and signed webhook pushes
docs/              design documents 01–10 and the decision log
```
