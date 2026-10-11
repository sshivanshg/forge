# Project Decision Log

Scope decisions, newest first. **When a decision here conflicts with another doc, this log wins** until that doc is updated.

---

## D-002 — Kubernetes is dropped (2026-10-11)

**Decision:** Forge will **not** use Kubernetes. The runtime stays **Docker + Traefik** for the whole project, on a laptop locally and on AWS EC2 for the final deployment.

**Why:** Kubernetes is not feasible within the course timeline. We'd rather go deep on what we build ourselves.

**What replaces it in M2:**
| Was (Kubernetes) | Now (Docker) |
|------------------|--------------|
| K8s Deployment with replicas | Forge starts N container replicas per app, and Traefik load-balances across them |
| Rolling update | Forge's own rolling deploy: replace replicas one at a time, health-checking each |
| HPA autoscaling | Forge's own scaler: reads Prometheus metrics → adds or removes replicas (min/max limits) |
| `KubernetesRuntimeProvider` | Not built. `RuntimeProvider` stays an interface, with Docker as its only implementation. K8s is listed as future work. |
| k3s on EC2 | Docker Compose on EC2 |

**Not mentioned** in the submission, pitch, or demo.

**Docs to update:** 02-architecture-hld, 03-lld-class-design, 06-roadmap (week 9), 08-viva-guide, README.

---

## D-001 — Forge is an agentic platform (2026-10-11)

**Decision:** Forge is submitted and built as an **agentic** deployment platform. The AI agent is **core scope**, not a week-12 extra.

**What the agent does** (it uses Forge's own services as tools: logs, metrics, commit diff, config, redeploy, rollback):
1. **Setup agent:** when stack detection fails, it reads the repo, writes a Dockerfile, port and health path, and test-builds it.
2. **Failure investigator:** when a deploy fails, it reads the logs, the diff and the status history, finds the root cause, and suggests a fix or opens a fix PR.
3. **Runtime guardian:** after a deploy, it watches error rate and latency, and recommends a rollback or a scale-out with an explanation.

**Guardrails:** risky actions (rollback, opening a PR, scaling) need the user's approval. Every agent step is logged (an audit trail) and has a step and cost budget.

**Tech:** Java only (Spring AI or the Anthropic Java SDK). The agent's tools are the existing Java service interfaces.

**Docs to update:** 01-PRD, 02-architecture-hld, 03-lld-class-design, 04-database-schema (agent runs and steps tables), 05-api-spec, 06-roadmap (the agent spread across M1 and M2), 08-viva-guide.

**Submission text:**
> **Title:** Forge — An Agentic Cloud Deployment Platform that Builds, Deploys, Diagnoses, and Heals Applications from GitHub
>
> **Description:** Deploying an application today requires students and small teams to write Dockerfiles, manage servers, configure routing, and debug cryptic build and runtime failures. Most beginners give up at "my deploy failed and I don't know why." Forge is a Render/Railway-style platform: connect a GitHub repository and every push is automatically built into a container, deployed with zero downtime, health-checked, and monitored. Built into the platform is an AI agent that uses Forge's own tools (logs, metrics, commit diffs, rollback, redeploy). It configures projects it cannot auto-detect, investigates failed deployments and proposes fixes, and watches live apps to recommend a rollback or scale-out when health degrades. Risky actions always need the user's approval. Target users are students, indie developers and small startup teams who want production-grade deployment without a DevOps engineer. The platform is built in Java 21 and Spring Boot, with Kafka, Redis, Docker and AWS, and is designed around OOP, SOLID, design patterns and distributed-systems principles.
