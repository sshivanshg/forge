# Sample apps

Small apps used to demo and test Forge.

| App | Stack | Port | Health check path |
|-----|-------|------|-------------------|
| `hello-node` | Node.js, no dependencies | `PORT` (8080 default) | `/health` |
| `hello-spring` | Spring Boot 3.5 + Actuator | `SERVER_PORT` (8080 default) | `/actuator/health` |

Both read `GREETING` from the environment, which makes it easy to show environment variables working.

To deploy them from GitHub, push each folder to its own **public** repository. To demo offline instead, run
`scripts/demo-repos.sh`, which turns them into local Git repositories that Forge can clone.
