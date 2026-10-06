# 08 — Viva / Demo Guide

How to explain Forge end to end, in the order an instructor will probe it.

## 1. The 60-second pitch

> "Forge is a mini Render or Railway. You connect a GitHub repo and click Deploy, or just `git push`. Forge clones that exact commit, detects whether it's a Spring Boot, Node, or Dockerfile project, builds a Docker image, pushes it to a registry, starts it as a container, health-checks it, and only then switches traffic to it. So a bad deploy never takes the site down. It's built in Java 21 and Spring Boot as a **modular monolith**. The slow work runs asynchronously on a job queue, first Postgres and then Kafka with a transactional outbox, so the API stays fast and a crashed worker never loses a deployment. In M2 it runs on Kubernetes on AWS, with rolling updates, autoscaling, Prometheus and Grafana monitoring, and an AI assistant that explains failed deploys."

## 2. The end-to-end walkthrough (12 steps)

Draw [the sequence diagram](02-architecture-hld.md#5-the-core-flow-end-to-end-click-deploy) on the board and narrate:

1. **Trigger.** The developer clicks Deploy, *or* GitHub sends a signed `push` webhook. We verify the HMAC signature and dedupe by delivery ID.
2. **Authenticate and authorise.** The JWT filter identifies the user. The service loads the project with `findByIdAndOwnerId`, so another user's project is a 404.
3. **Pin the commit.** We resolve the branch HEAD to an exact SHA. Deploys are reproducible.
4. **Record intent atomically.** In one DB transaction: insert the `Deployment(QUEUED)` and the build job (an outbox event in M2). Older queued deploys of this project are superseded.
5. **Return immediately.** `202 Accepted` + deployment ID. The UI opens an SSE log stream.
6. **Claim.** A worker claims the job with `FOR UPDATE SKIP LOCKED` (M1), or receives it from Kafka partitioned by projectId (M2). The lease and heartbeat protect against crashes.
7. **Checkout.** JGit shallow-clones that SHA into a temp workspace (always cleaned up).
8. **Detect and build.** The chain of detectors picks the build type, and the Strategy generates a Dockerfile if needed. docker-java builds the image, and every log line goes through `LogSink` to the DB and the SSE stream.
9. **Publish.** The image is tagged `forge/<slug>:<sha>` and pushed to the registry. Status becomes `DEPLOYING`.
10. **Run green.** `RuntimeProvider` starts the new container (or K8s pods) with decrypted env vars, resource limits, and routing labels.
11. **Verify.** `HealthProbe` polls the health path for up to 60 s. Status is `HEALTH_CHECKING`.
12. **Switch or roll back.** If healthy: traffic moves to green, blue is stopped, status becomes `LIVE`, and the old deployment becomes `SUPERSEDED`. If not: green is removed, the status becomes `FAILED(UNHEALTHY)`, blue was never touched, and the AI investigator explains why. Every transition was validated by the state machine and written to `deployment_events`. Listeners send notifications after commit.

## 3. Map the course syllabus to code

| Syllabus topic | Where to point |
|----------------|----------------|
| OOP pillars | [03 §8](03-lld-class-design.md#8-oop-pillars-where-they-show-up): `Deployment` encapsulation, `RuntimeProvider` abstraction, `AbstractJobHandler` inheritance, `List<BuildStrategy>` polymorphism |
| SOLID | [03 §7](03-lld-class-design.md#7-solid-concrete-examples-you-can-point-at) |
| Design patterns | [03 §6](03-lld-class-design.md#6-design-patterns-where-each-one-is-and-why): more than 15 patterns, each with a concrete class |
| LLD | Class diagrams, state machine, exception hierarchy, concurrency model ([03](03-lld-class-design.md)) |
| HLD | Context, container, and module diagrams, ADRs ([02](02-architecture-hld.md)) |
| Databases | ERD, indexes, partial unique index, optimistic locking, `SKIP LOCKED` ([04](04-database-schema.md)) |
| Distributed systems | Outbox, at-least-once + idempotency, partition ordering, leases, circuit breakers, failure modes |
| Concurrency | Virtual threads, semaphore back-pressure, optimistic locking, advisory locks |
| Cloud / DevOps | Docker, Kubernetes, AWS, CI/CD, Prometheus, Grafana |
| Security | BCrypt, JWT + rotation, AES-GCM, HMAC webhooks, ownership checks, resource limits |
| Testing | Test pyramid, Testcontainers, ArchUnit, Gatling, chaos tests ([07](07-engineering-standards.md)) |

## 4. Likely questions, with model answers

**Q: Why not microservices from the start?**
A: Microservices cost a lot to operate: network calls, distributed transactions, and many deployables. With one developer and an unclear domain, a modular monolith gives the same boundaries (enforced by Spring Modulith tests) at a fraction of the cost. We extracted only the workers, because builds are CPU-heavy, bursty, and risky. They need independent scaling and failure isolation from the API. The API and dashboard don't.

**Q: Why not just call the build directly in the HTTP request?**
A: Builds take minutes. Holding a request thread and an HTTP connection that long breaks under load and is lost on restart. Queueing turns it into durable, retryable, horizontally scalable background work, and the API responds in milliseconds.

**Q: Why Postgres as a queue first, and why move to Kafka?**
A: Postgres let us enqueue in the *same transaction* as the deployment insert, with zero extra infrastructure, and `SKIP LOCKED` makes concurrent claiming safe. Its limits are polling load, all load on one DB, and no fan-out to multiple independent consumers. Kafka gives consumer groups for horizontal scaling, per-key ordering, replay, and fan-out (notifications, logs, and AI all consume the same status events). The `JobQueue` interface meant the switch was a new implementation, not a rewrite.

**Q: What is the dual-write problem, and how do you solve it?**
A: Writing to the DB and then to Kafka is two separate systems. A crash in between leaves them inconsistent. We write the event into an `outbox_events` table in the same DB transaction, and a relay publishes it to Kafka afterwards. The worst case is a duplicate publish, which idempotent consumers handle.

**Q: Exactly-once?**
A: True exactly-once delivery across systems isn't practical. We use at-least-once delivery plus idempotent processing: `processed_events` dedup, deterministic image tags (`sha`-based), unique job idempotency keys, and the state machine rejecting repeated transitions. The result is effectively-once.

**Q: A worker dies mid-build. What happens?**
A: M1: its lease (`locked_until`) expires, the reaper puts the job back to `PENDING`, and another worker reclaims it. M2: the Kafka consumer session times out, the partition is rebalanced to another worker, and the uncommitted offset is redelivered. The deployment is still `BUILDING`. The retry rebuilds the same SHA, producing the same tag, so it is safe.

**Q: How do you guarantee only one deploy per project at a time?**
A: In layers. The DB has a partial unique index on active statuses. M1 uses an advisory lock during the deploy phase. M2 uses Kafka key = projectId, so one partition processes them in order. Newer requests supersede older queued ones.

**Q: How is it zero-downtime?**
A: Blue-green on Docker: the new container must pass health checks before it receives traffic, and only then is the old one stopped. Rolling update on Kubernetes with `maxUnavailable=0` and readiness probes. In both cases, a failed new version is discarded while the old one keeps serving.

**Q: Optimistic vs pessimistic locking. Which did you use, and where?**
A: Optimistic (`@Version`) on `Deployment`, because conflicts are rare and we'd rather detect them than block. Pessimistic row locks (`FOR UPDATE SKIP LOCKED`) for claiming jobs, where contention is the normal case.

**Q: How do you store secrets?**
A: AES-256-GCM with a random IV per value. GCM also detects tampering. The master key lives only in an env var or K8s Secret. Values are masked in the API and decrypted only at container start. Passwords are not encrypted but hashed with BCrypt, because we never need them back.

**Q: Isn't running users' code dangerous?**
A: Yes. We apply resource limits, a non-root user, a build timeout, a separate network from our databases, and no Docker socket in user containers. Real platforms use microVMs (Firecracker) for strong isolation. We list that as a known limitation and future work.

**Q: How would this scale to 10,000 users?**
A: The API is stateless, so add replicas behind the load balancer (Redis carries the SSE fan-out). Add workers and Kafka partitions. Move logs to object storage or Loki. Use Postgres read replicas for history pages. Shard build nodes by region. Use a dedicated build cluster with BuildKit.

**Q: What did you observe in your load test?**
A: *(Fill in after week 12:)* queue drain time for 50 deploys with 1 worker vs 3 workers, and build-duration p50/p95 from Grafana.

**Q: Which design pattern are you proudest of?**
A: Strategy + DIP on `RuntimeProvider`. M1 ran on Docker, M2 on Kubernetes, and the deploy job handler didn't change. That is Open/Closed and Liskov Substitution demonstrated, not just claimed.

## 5. Final demo script (about 8 minutes)

1. **Architecture slide** (30 s): the container diagram.
2. **Happy path** (2 min): edit text in `hello-spring` → `git push` → the dashboard shows the webhook-triggered deploy → build logs stream → status timeline → open the URL → new text.
3. **Zero downtime** (1 min): a terminal runs a curl loop during a redeploy. No errors.
4. **Failure safety** (1.5 min): push a commit that crashes on boot → `FAILED(UNHEALTHY)` → the site still serves the old version → open the AI insight.
5. **Rollback** (30 s): one click back to the previous deployment. It doesn't rebuild.
6. **Resilience** (1.5 min): kill a worker container mid-build → Kafka rebalances → the deploy still completes.
7. **Observability** (1 min): Grafana platform dashboard (build durations, failure rate, queue depth). K8s HPA scaling the app under a Gatling load.
8. **Close** (30 s): the trade-offs and future work slide.

Always have a **recorded backup video** of the same script.
