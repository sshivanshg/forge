# 10 — Build Plan to the Evaluation (first week of November 2026)

Scope is frozen ([DECISIONS D-003](DECISIONS.md)): Milestone 1 plus the agent. Everything else is future work.

| Day | Date | Work | Status |
|-----|------|------|--------|
| 1 | Sun 26 Oct | Backend core: all 11 modules, migrations, job queue, build and deploy pipeline, agent, unit, integration and architecture tests. Docs rewritten to the rubric. | ✅ done: 104 tests green (110 after D-004) |
| 2 | Mon 27 Oct | End-to-end on real Docker: build and run `hello-node` and `hello-spring` through Traefik. Fix what breaks. | ✅ hello-node verified (deploy, zero-downtime swap 0/1,340 errors, failure + agent, rollback) · ✅ hello-spring live in 55 s; job reclaimed by the reaper after a Docker crash |
| 3 | Tue 28 Oct | Dashboard (Next.js): login, projects, deploy, live logs, pipeline stepper, agent card, env vars, rollback | ✅ built and clicked through: projects, deploy page, agent card, env add/delete, runtime logs, settings, rollback |
| 4 | Wed 29 Oct | Real GitHub path: OAuth app, public sample repos, a webhook via smee.io. CI on GitHub Actions. | ✅ CI workflow · ⏳ OAuth app and public repos |
| 4 | Wed 29 Oct | Engine moved from Docker to **Apple container** ([D-004](DECISIONS.md)): new build and runtime adapters, routing table for Traefik, no `deployment` changes. | ✅ verified on hello-node: deploy, zero-downtime swap (402 requests, 0 errors), wrong-port and crash failures with the correct agent diagnosis, rollback in 4 s · ✅ hello-spring live on Apple container in about 1.5 min (Maven build in the builder VM, env value served) · 110 tests green |
| 5 | Thu 30 Oct | Polish: error states, empty states, README quick-start, screenshots in docs | ✅ README, docs 08–09 · ⏳ screenshots |
| 6 | Fri 31 Oct | Deploy Forge to a public server ([11](11-deployment.md)), demo rehearsal with the presenter, record the backup video, freeze `v1.0.0` | ✅ deployment guide and production files · ⏳ server, rehearsal, video, tag |
| 6 | Fri 31 Oct | Full end-to-end run as a user ([D-005](DECISIONS.md)) | ✅ 114 tests · deploy, zero-downtime v2 (583 requests, 0 errors), wrong port and crash with agent diagnosis, rollback in 4 s · ✅ **self-healing**: deleted live container back in 12 s with no rebuild · ✅ wrong port now fails in 15 s instead of 102 s · ✅ one-click demo login · UI polish |
| 7 | Sat 1 Nov – eval | Presenter learns the modules ([09](09-viva-guide.md)). Q&A drills. Buffer for fixes. | ⏳ |

## Definition of done for the evaluation

- [ ] `scripts/infra.sh up` + `./mvnw spring-boot:run` + `npm run dev` brings up everything (with `container system start` and the local PostgreSQL 16 running)
- [ ] All tests green (`FORGE_TEST_DB_URL=jdbc:postgresql://localhost:5432/forge_test ./mvnw verify` locally, `./mvnw verify` with Testcontainers in CI): unit, integration, architecture
- [ ] Live demo: deploy → live URL; v2 with zero downtime; broken push → old version still up + agent diagnosis; rollback
- [ ] Every diagram in docs 01–07 matches the code (class names, methods, tables)
- [ ] Backup demo video recorded
- [ ] Presenter can walk through [09-viva-guide.md](09-viva-guide.md) without notes

## Future work (presented, not built)

Kafka + transactional outbox, Redis (rate limits, idempotency keys, multi-instance SSE), extracted `forge-worker` service, Kubernetes runtime provider with HPA, AWS (EC2 + ECR + RDS), Prometheus + Grafana dashboards, microVM isolation on the Docker engine (Apple container already gives each app its own VM), teams and billing.
