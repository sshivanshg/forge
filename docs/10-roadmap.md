# 10 — Build Plan to the Evaluation (first week of November 2026)

Scope is frozen ([DECISIONS D-003](DECISIONS.md)): Milestone 1 plus the agent. Everything else is future work.

| Day | Date | Work | Status |
|-----|------|------|--------|
| 1 | Sun 26 Oct | Backend core: all 11 modules, migrations, job queue, build and deploy pipeline, agent, unit, integration and architecture tests. Docs rewritten to the rubric. | ✅ code written · ⏳ integration tests need Docker |
| 2 | Mon 27 Oct | End-to-end on real Docker: build and run `hello-node` and `hello-spring` through Traefik. Fix what breaks. | ⏳ |
| 3 | Tue 28 Oct | Dashboard (Next.js): login, projects, deploy, live logs, pipeline stepper, agent card, env vars, rollback | 🚧 in progress |
| 4 | Wed 29 Oct | Real GitHub path: OAuth app, public sample repos, a webhook via smee.io. CI on GitHub Actions. | ⏳ |
| 5 | Thu 30 Oct | Polish: error states, empty states, README quick-start, screenshots in docs | ⏳ |
| 6 | Fri 31 Oct | Demo rehearsal with the presenter, record the backup video, freeze `v1.0.0` | ⏳ |
| 7 | Sat 1 Nov – eval | Presenter learns the modules ([09](09-viva-guide.md)). Q&A drills. Buffer for fixes. | ⏳ |

## Definition of done for the evaluation

- [ ] `docker compose -f infra/docker-compose.yml up -d` + `./mvnw spring-boot:run` + `npm run dev` brings up everything
- [ ] All tests green (`./mvnw verify`): unit, Testcontainers integration, architecture
- [ ] Live demo: deploy → live URL; v2 with zero downtime; broken push → old version still up + agent diagnosis; rollback
- [ ] Every diagram in docs 01–07 matches the code (class names, methods, tables)
- [ ] Backup demo video recorded
- [ ] Presenter can walk through [09-viva-guide.md](09-viva-guide.md) without notes

## Future work (presented, not built)

Kafka + transactional outbox, Redis (rate limits, idempotency keys, multi-instance SSE), extracted `forge-worker` service, Kubernetes runtime provider with HPA, AWS (EC2 + ECR + RDS), Prometheus + Grafana dashboards, microVM isolation, teams and billing.
