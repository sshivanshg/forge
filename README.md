# Forge — Cloud Application Deployment Platform

> A scalable Render/Railway-like platform that automatically builds, containerizes, deploys, monitors, and manages applications from GitHub repositories, built with Java 21 + Spring Boot and cloud-native infrastructure.

> **Scope updates (2026-10-11):** Forge is an **agentic** platform, and **Kubernetes is dropped**. See the [Decision Log](docs/DECISIONS.md), which overrides the other docs until they are updated.

**Problem statement:** Design and Development of a Scalable Cloud-Native Application Deployment and Orchestration Platform.

```
GitHub Repo ─► Build Queue ─► Build Worker ─► Docker Image ─► Registry ─► Deploy ─► Health Check ─► Live URL
```

## Planning documents (read in this order)

| # | Document | What it answers |
|---|----------|-----------------|
| 1 | [PRD](docs/01-PRD.md) | What are we building, for whom, and what is in or out of scope? |
| 2 | [Architecture (HLD)](docs/02-architecture-hld.md) | What are the big boxes, how do they talk, and why these technologies? |
| 3 | [Low-Level Design](docs/03-lld-class-design.md) | Packages, classes, the state machine, design patterns, and SOLID |
| 4 | [Database Schema](docs/04-database-schema.md) | ER diagram, every table, indexes, and constraints |
| 5 | [API Specification](docs/05-api-spec.md) | Every REST endpoint, request and response, and error format |
| 6 | [Roadmap](docs/06-roadmap.md) | Day 0 through week 12, with a checklist for each week |
| 7 | [Engineering Standards](docs/07-engineering-standards.md) | Coding rules, testing, git workflow, and CI |
| 8 | [Viva / Demo Guide](docs/08-viva-guide.md) | How to explain the system end to end, plus likely questions |
| — | [Decision Log](docs/DECISIONS.md) | Scope changes, newest first. Wins over the other docs. |

## Locked scope

| Area | Choice |
|------|--------|
| Language | **Java 21 (LTS)**. All backend code is Java. |
| Framework | Spring Boot 3.5.x (Web, Security, Data JPA, Validation, Actuator) |
| Database | PostgreSQL 16 + Flyway migrations |
| Messaging | Postgres job queue (M1) → **Kafka** (M2) |
| Cache / coordination | **Redis** (M2) |
| Containers | Docker (M1) → **Kubernetes** (M2) |
| Routing | Traefik reverse proxy (`<app>.localhost` locally, real domain on AWS) |
| Observability | Spring Actuator + Micrometer + Prometheus + Grafana |
| Cloud | AWS (EC2 + k3s, ECR, optional RDS) |
| Frontend | Minimal Next.js dashboard. It is the only non-Java code. |
| Architecture | Modular monolith → extract async workers in M2 |

## Milestones at a glance

- **M1 (weeks 1–6) — "It deploys":** auth, GitHub connection, projects, Docker builds, deployment state machine, live URL, logs, dashboard.
- **M2 (weeks 7–12) — "It scales and survives failure":** Kafka, transactional outbox, Redis, idempotency, retries and circuit breakers, Kubernetes, rolling deploys, autoscaling, observability, rollback, AI failure investigator, AWS.
