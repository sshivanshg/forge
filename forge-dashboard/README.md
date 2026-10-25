# Forge Dashboard

The web dashboard for **Forge**, an agentic deployment platform: connect a GitHub repo, press
Deploy, watch the pipeline and logs live, and — when a deployment fails — read the Forge Agent's
diagnosis of what went wrong and how to fix it.

Built with Next.js (App Router) + TypeScript + Tailwind CSS v4. All data is fetched client-side
from the Spring Boot control plane in `../forge-server`.

## Running locally

Requirements: Node 20+ and a running `forge-server` (default `http://localhost:8080`).

```bash
cp .env.example .env.local   # adjust NEXT_PUBLIC_API_URL if the API is elsewhere
npm install
npm run dev                  # http://localhost:3000
```

forge-server must allow the dashboard's origin in its CORS settings (`http://localhost:3000`) and
should know the dashboard URL so the GitHub OAuth callback can redirect back to `/settings`.

| Variable              | Default                 | Purpose                                                       |
| --------------------- | ----------------------- | ------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080` | Base URL of forge-server. Inlined into the bundle at build time. |

Other scripts: `npm run lint`, `npm run build`, `npm start` (serves the production build).

## Docker

`next.config.ts` uses `output: "standalone"`, so the image only carries the minimal Node server.

```bash
docker build --build-arg NEXT_PUBLIC_API_URL=http://localhost:8080 -t forge-dashboard .
docker run -p 3000:3000 forge-dashboard
```

Because `NEXT_PUBLIC_*` values are compiled into the client bundle, change the API URL by
rebuilding the image with a different `--build-arg`.

## Pages

| Route               | What it does                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `/login`, `/register` | Email + password auth (password ≥ 10 characters). Registering signs you straight in.        |
| `/projects`         | Project cards with the latest deployment status and live URL.                                 |
| `/projects/new`     | Pick a repo from your GitHub account (if connected) or type `owner/name` for public repos.     |
| `/projects/[id]`    | Deploy button + tabs: Deployments (history, rollback), Environment, Runtime logs, Settings.   |
| `/deployments/[id]` | Pipeline stepper, live build/deploy log, cancel/rollback, and the Forge Agent diagnosis card. |
| `/settings`         | Connect/disconnect GitHub, account details.                                                   |

## How it talks to the API

- **`src/lib/api.ts`** — typed client for `/api/v1`. Adds `Authorization: Bearer <access token>`;
  on a `401` it calls `POST /auth/refresh` once (concurrent requests share a single refresh),
  retries, and otherwise clears the session and sends you to `/login`. Errors are RFC 9457
  ProblemDetails; the client surfaces `detail` and maps `errors[]` to per-field messages.
- **Tokens** are kept in `localStorage` so a refresh keeps you signed in. That is a demo trade-off:
  in production the refresh token belongs in an `httpOnly`, `SameSite` cookie.
- **`src/lib/useEventStream.ts`** — Server-Sent Events hook. `EventSource` can't send headers, so
  the access token travels as `?access_token=`. If a stream is rejected (e.g. the 15-minute token
  expired) it refreshes the token and reconnects.
- **Deployment log stream** (`/deployments/{id}/logs/stream`): the server replays history then
  streams `log` (de-duplicated by `seq`), `status` (drives the stepper) and `done` (closes the stream
  and refetches the deployment).
- **Agent diagnosis** (`/deployments/{id}/insight`): returns 404 until the agent has finished, so
  the dashboard polls every 2 s for ~30 s after a failure, showing a "thinking…" state meanwhile.

## Project layout

```
src/
  app/
    (auth)/login, (auth)/register     public pages
    (app)/projects, projects/new, projects/[id], deployments/[id], settings
                                      signed-in pages, wrapped in the app shell
  components/
    ui/                               Button, Input, Card, Modal, Tabs, Toast, StatusBadge, ...
    deployment/                       PipelineStepper, AgentInsightCard, RollbackDialog, TriggerLabel
    project/                          Deployments / Environment / Runtime logs / Settings tabs
    LogTerminal.tsx                   auto-scrolling log view with "jump to bottom"
    AuthProvider.tsx, AppShell.tsx
  lib/
    api.ts  types.ts  useEventStream.ts  hooks.ts  status.ts  format.ts
```
