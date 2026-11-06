import type { ReactNode } from "react";
import { CodeBlock } from "./CodeBlock";

export interface DocSection {
  id: string;
  title: string;
  body: ReactNode;
}
export interface DocPage {
  slug: string;
  title: string;
  group: string;
  description: string;
  sections: DocSection[];
}

const C = ({ children }: { children: ReactNode }) => (
  <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[0.86em] text-brand-200">{children}</code>
);
const P = ({ children }: { children: ReactNode }) => <p className="my-4 leading-7 text-zinc-300">{children}</p>;
const UL = ({ items }: { items: ReactNode[] }) => (
  <ul className="my-4 list-disc space-y-2 pl-5 leading-7 text-zinc-300 marker:text-brand-500">
    {items.map((it, i) => (
      <li key={i}>{it}</li>
    ))}
  </ul>
);
function T({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="scrollbar-thin my-5 overflow-x-auto rounded-lg border border-white/[0.08]">
      <table className="w-full min-w-[520px] text-left text-[13.5px]">
        <thead className="bg-white/[0.03] text-zinc-400">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06] text-zinc-300">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 align-top">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
const Note = ({ children }: { children: ReactNode }) => (
  <div className="my-5 rounded-lg border border-brand-500/20 bg-brand-500/[0.06] px-4 py-3 text-[14px] leading-6 text-zinc-300">{children}</div>
);

export const DOCS: DocPage[] = [
  {
    slug: "getting-started",
    group: "Introduction",
    title: "Getting started",
    description: "Run Forge locally: prerequisites, secrets, infrastructure, the server and the dashboard.",
    sections: [
      {
        id: "what-is-forge",
        title: "What Forge is",
        body: (
          <P>
            Forge is a Render/Railway-style platform. Point it at a Git repository and click Deploy, or just <C>git push</C>. Forge
            clones that exact commit, detects the stack, builds a container image, starts it in its own lightweight VM, health-checks
            it, and only then moves traffic to it. The control plane is a Spring Boot modular monolith of 11 modules.
          </P>
        ),
      },
      {
        id: "prerequisites",
        title: "Prerequisites",
        body: (
          <>
            <UL
              items={[
                <>
                  macOS 26 or later on Apple silicon, with Apple <C>container</C> installed and started (<C>container system start</C>)
                </>,
                "Java 21 and Node 22",
                <>
                  PostgreSQL 16 from Homebrew, with a role and database named <C>forge</C>
                </>,
              ]}
            />
            <CodeBlock
              lang="bash"
              code={`brew install postgresql@16 && brew services start postgresql@16
createuser forge --pwprompt   # password: forge (the default in application.yml)
createdb --owner forge forge`}
            />
            <Note>
              On Linux, set <C>forge.engine=docker</C> (<C>FORGE_ENGINE=docker</C>) to use the Docker adapters instead. The pipeline
              code is the same for both engines.
            </Note>
          </>
        ),
      },
      {
        id: "configure",
        title: "Configure secrets",
        body: (
          <>
            <P>
              Copy the example environment file, then fill in <C>FORGE_ENCRYPTION_KEY</C> and <C>FORGE_JWT_SECRET</C>, each generated
              with <C>openssl rand -base64 32</C>.
            </P>
            <CodeBlock lang="bash" code={`cp .env.example .env\nopenssl rand -base64 32`} />
          </>
        ),
      },
      {
        id: "run",
        title: "Start everything",
        body: (
          <>
            <P>
              <C>scripts/infra.sh up</C> starts Traefik and Mailpit as Apple containers. The first run adds a{" "}
              <C>FORGE_ROUTING_TOKEN</C> to <C>.env</C>; Traefik sends it when it polls Forge&apos;s routing table.
            </P>
            <CodeBlock
              lang="bash"
              code={`scripts/infra.sh up
./mvnw -pl forge-server spring-boot:run
cd forge-dashboard && npm install && npm run dev`}
            />
            <T
              head={["URL", "What"]}
              rows={[
                [<C key="a">http://localhost:3000</C>, "Dashboard"],
                [<C key="a">http://localhost:8080/swagger-ui.html</C>, "API docs"],
                [<C key="a">http://&lt;project-slug&gt;.localhost</C>, "Deployed apps (via Traefik)"],
                [<C key="a">http://localhost:8090</C>, "Traefik dashboard"],
                [<C key="a">http://localhost:8025</C>, "Notification emails (Mailpit)"],
              ]}
            />
          </>
        ),
      },
      {
        id: "tests",
        title: "Run the tests",
        body: (
          <>
            <P>
              Unit, integration and architecture tests plus a coverage gate. Without <C>FORGE_TEST_DB_URL</C> (for example in CI), the
              integration tests start Postgres with Testcontainers.
            </P>
            <CodeBlock lang="bash" code={`FORGE_TEST_DB_URL=jdbc:postgresql://localhost:5432/forge_test ./mvnw verify`} />
          </>
        ),
      },
    ],
  },
  {
    slug: "deploying",
    group: "Guides",
    title: "Deploying a project",
    description: "Create a project, trigger a deploy, follow it live and understand each status.",
    sections: [
      {
        id: "create",
        title: "Create a project",
        body: (
          <>
            <P>
              A project points at a repository and branch. Optional settings are the root directory, build type (default{" "}
              <C>AUTO</C>), port, health-check path, auto-deploy, rollout mode and replicas (1 to 3). The slug becomes the URL:{" "}
              <C>http://slug.localhost</C>.
            </P>
            <CodeBlock
              lang="http"
              code={`POST /api/v1/projects
{ "name": "hello-node", "repoOwner": "sshivanshg", "repoName": "hello-node",
  "branch": "main", "port": 8080, "healthCheckPath": "/health", "autoDeploy": true }`}
            />
          </>
        ),
      },
      {
        id: "deploy",
        title: "Trigger a deploy",
        body: (
          <>
            <P>
              Click Deploy, call the API, or push to the branch. Forge resolves the branch to an exact 40-character SHA and answers{" "}
              <C>202 Accepted</C> immediately. The deployment row and its BUILD job are written in the same transaction.
            </P>
            <CodeBlock lang="http" code={`POST /api/v1/projects/{id}/deployments\n{ "commitSha": "3f2a9c1b..." }   // optional`} />
          </>
        ),
      },
      {
        id: "statuses",
        title: "Deployment statuses",
        body: (
          <T
            head={["Status", "Meaning"]}
            rows={[
              [<C key="s">QUEUED</C>, "Waiting for a worker. Older queued deployments of the project are cancelled."],
              [<C key="s">BUILDING</C>, "Cloning the commit, detecting the stack, building the image."],
              [<C key="s">DEPLOYING</C>, "Starting the new container(s) next to the live version."],
              [<C key="s">HEALTH_CHECKING</C>, "Polling the health path every 2 s, for up to 90 s."],
              [<C key="s">CANARY</C>, "Serving 20%, then 50% of the traffic while it is compared with the live version."],
              [<C key="s">LIVE</C>, "Serving all traffic."],
              [<C key="s">FAILED</C>, "Stopped with a reason; the previous version kept serving."],
              [<C key="s">CANCELLED · SUPERSEDED · STOPPED</C>, "Terminal states."],
            ]}
          />
        ),
      },
      {
        id: "logs",
        title: "Live logs",
        body: (
          <>
            <P>
              Build output streams over Server-Sent Events. On reconnect the browser sends <C>Last-Event-ID</C> and the stream resumes
              from that sequence number.
            </P>
            <CodeBlock
              lang="text"
              code={`event: log
id: 42
data: {"seq":42,"source":"BUILD","line":"Step 4/9 : RUN npm ci","ts":"…"}

event: status
data: {"status":"HEALTH_CHECKING","failureReason":null}

event: done
data: {"status":"LIVE"}`}
            />
          </>
        ),
      },
    ],
  },
  {
    slug: "build-detection",
    group: "Guides",
    title: "Build detection",
    description: "How Forge decides how to build a repository: Dockerfile, Maven, Gradle or Node.",
    sections: [
      {
        id: "chain",
        title: "The detector chain",
        body: (
          <>
            <P>
              With build type <C>AUTO</C>, <C>DetectorChain</C> asks each detector in order and takes the first answer (Chain of
              Responsibility). Your own Dockerfile always wins.
            </P>
            <T
              head={["Order", "Build type", "Marker file"]}
              rows={[
                ["1", <C key="t">DOCKERFILE</C>, <C key="m">Dockerfile</C>],
                ["2", <C key="t">MAVEN</C>, <C key="m">pom.xml</C>],
                ["3", <C key="t">GRADLE</C>, <><C>build.gradle.kts</C> or <C>build.gradle</C></>],
                ["4", <C key="t">NODE</C>, <C key="m">package.json</C>],
              ]}
            />
            <P>
              No match fails the build with <C>UNSUPPORTED_PROJECT</C>, and the agent explains what it looked for.
            </P>
          </>
        ),
      },
      {
        id: "templates",
        title: "Generated Dockerfiles",
        body: (
          <>
            <P>
              <C>BuildStrategyFactory</C> picks a strategy for the type. Template strategies render a Dockerfile from{" "}
              <C>build-templates/</C> into the build context (Template Method: render, then write).
            </P>
            <UL
              items={[
                "Maven: build with Maven, run the fat jar on a JRE 21 image.",
                "Gradle: the same idea with the Gradle image.",
                "Node: npm install, the build script if there is one, then npm start.",
              ]}
            />
          </>
        ),
      },
      {
        id: "image",
        title: "Building the image",
        body: (
          <P>
            On Apple container, <C>AppleContainerImageBuilder</C> runs <C>container build</C> and the image stays in the engine&apos;s
            local store, so there is no registry and no push. On Docker, <C>DockerImageBuilder</C> uses docker-java and{" "}
            <C>RetryingImageBuilder</C> adds push retries (Decorator). The same commit always gives the same image tag.
          </P>
        ),
      },
    ],
  },
  {
    slug: "rollouts",
    group: "Guides",
    title: "Rollouts",
    description: "Blue-green, canary analysis, replicas, rollback and self-healing.",
    sections: [
      {
        id: "blue-green",
        title: "Blue-green",
        body: (
          <P>
            The new (green) container starts beside the live (blue) one. Only when green passes its health check does traffic switch;
            blue is then drained and stopped. If green is unhealthy it is removed and blue never stopped serving. Measured on Apple
            container: 583 requests during a v2 swap, 0 errors.
          </P>
        ),
      },
      {
        id: "canary",
        title: "Canary",
        body: (
          <>
            <P>
              With canary mode on, after the health check the new version gets 20%, then 50% of the traffic, 15 s each. Each version is
              its own Traefik service under one weighted service. At every step <C>CanaryAnalysis</C> compares the canary&apos;s 5xx rate
              and mean latency with the live version&apos;s over the same period.
            </P>
            <T
              head={["Condition", "Result"]}
              rows={[
                ["More than 5 points more errors", <C key="r">FAILED(CANARY_REGRESSION)</C>],
                ["2× and 200 ms slower", <C key="r">FAILED(CANARY_REGRESSION)</C>],
                ["Too little traffic", "Judged on health alone, and the log says so"],
                ["Otherwise", <>Next step, then <C>LIVE</C> at 100%</>],
              ]}
            />
            <P>
              Forge drives 10 test requests/s through the proxy so a quiet app can still be judged. Measured: 927 visitor requests, 0
              errors across 20 → 50 → 100%; a release with 30% failing pages was rolled back at 20% (3 errors in 574).
            </P>
            <Note>
              Rollbacks, recoveries and first deploys always switch at once (<C>RolloutSelector</C>). The Docker engine has no{" "}
              <C>TrafficSplitter</C> and falls back to blue-green.
            </Note>
          </>
        ),
      },
      {
        id: "replicas",
        title: "Replicas",
        body: (
          <P>
            A project can run 1 to 3 replicas. A deployment starts one container per replica and all must be healthy. Traefik balances
            across them. Deleting one of two replicas during a test: 646 requests, 0 errors while Forge recovered the set.
          </P>
        ),
      },
      {
        id: "rollback",
        title: "Rollback",
        body: (
          <>
            <P>
              Any deployment that went live can be the target of a rollback. The image already exists, so the new deployment goes
              straight from <C>QUEUED</C> to <C>DEPLOYING</C>. Measured: 4 s.
            </P>
            <CodeBlock lang="http" code={`POST /api/v1/deployments/{id}/rollback   → 202 new Deployment`} />
          </>
        ),
      },
      {
        id: "self-healing",
        title: "Self-healing",
        body: (
          <P>
            <C>LiveInstanceWatcher</C> checks every 30 s that each live deployment&apos;s container still runs. If not, it queues a{" "}
            <C>RECOVERY</C> deployment of the same image through the normal rollout. At most one recovery per live deployment, so a broken
            image can&apos;t loop. Measured: a deleted live container was back in 12 s with no rebuild.
          </P>
        ),
      },
    ],
  },
  {
    slug: "environment-variables",
    group: "Guides",
    title: "Environment variables",
    description: "Encrypted, masked environment variables and when they take effect.",
    sections: [
      {
        id: "storage",
        title: "How they are stored",
        body: (
          <P>
            Values are encrypted with AES-256-GCM by <C>EncryptionService</C>, with a random IV and tamper detection. The key comes only
            from <C>FORGE_ENCRYPTION_KEY</C>. They are masked in every response (<C>po••••••</C>) and decrypted only when a container
            starts. Before the agent reads logs, <C>SecretRedactor</C> removes every value.
          </P>
        ),
      },
      {
        id: "api",
        title: "API",
        body: (
          <>
            <CodeBlock
              lang="http"
              code={`GET    /api/v1/projects/{id}/env          → [{key, valuePreview, updatedAt}]
PUT    /api/v1/projects/{id}/env          {"vars": {"DATABASE_URL": "postgres://…"}}
                                          → 204 + X-Forge-Redeploy-Required: true
DELETE /api/v1/projects/{id}/env/{key}    → 204`}
            />
            <Note>
              Changes apply on the next deploy. Forge also sets <C>PORT</C> to the project&apos;s port.
            </Note>
          </>
        ),
      },
    ],
  },
  {
    slug: "webhooks",
    group: "Guides",
    title: "Webhooks",
    description: "Deploy on every git push with HMAC-verified, de-duplicated GitHub webhooks.",
    sections: [
      {
        id: "setup",
        title: "Set up",
        body: (
          <>
            <P>
              In the repository&apos;s GitHub settings, add a webhook pointing at <C>/api/v1/webhooks/github</C> with content type JSON,
              the push event, and the same secret as <C>FORGE_GITHUB_WEBHOOK_SECRET</C>. Enable auto-deploy on the project.
            </P>
            <CodeBlock lang="bash" code={`FORGE_GITHUB_WEBHOOK_SECRET=$(openssl rand -hex 32)`} />
          </>
        ),
      },
      {
        id: "verification",
        title: "Verification",
        body: (
          <>
            <UL
              items={[
                <>
                  <C>WebhookService</C> checks <C>X-Hub-Signature-256</C> (HMAC-SHA256) with a constant-time compare. A bad signature is{" "}
                  <C>401 INVALID_WEBHOOK_SIGNATURE</C>.
                </>,
                <>
                  <C>X-GitHub-Delivery</C> is the primary key of <C>webhook_deliveries</C>, so a GitHub retry is answered{" "}
                  <C>duplicate</C> and does nothing.
                </>,
                "Tag pushes and branch deletions are ignored.",
                <>
                  A deployment with trigger <C>WEBHOOK</C> is queued for every project with auto-deploy on that repository and branch.
                </>,
              ]}
            />
            <CodeBlock lang="json" code={`202 {"result": "accepted" | "duplicate" | "ignored"}`} />
          </>
        ),
      },
      {
        id: "offline",
        title: "Offline demo",
        body: (
          <P>
            With <C>FORGE_GIT_BASE_URL=file://…</C>, <C>scripts/demo-repos.sh</C> creates local Git repositories and{" "}
            <C>scripts/demo-push.sh</C> sends correctly signed webhook pushes, so a demo does not depend on GitHub or Wi-Fi.
          </P>
        ),
      },
    ],
  },
  {
    slug: "forge-agent",
    group: "Guides",
    title: "Forge Agent",
    description: "How the agent diagnoses failed deployments: evidence, rules, and the optional LLM.",
    sections: [
      {
        id: "flow",
        title: "How it works",
        body: (
          <P>
            <C>FailureInvestigator</C> listens for <C>DeploymentStatusChanged</C> to <C>FAILED</C> after commit, so the deployment module
            doesn&apos;t know it exists (Observer). It collects the failure reason and detail, the last log lines and the project&apos;s
            config, redacts secrets, and asks a <C>DiagnosisEngine</C>: Claude if <C>ANTHROPIC_API_KEY</C> is set, otherwise the rule
            engine. Any LLM error falls back to the rules.
          </P>
        ),
      },
      {
        id: "rules",
        title: "The 13 rules",
        body: (
          <>
            <P>Rules are tried in order; the first match wins, and a generic UNKNOWN diagnosis comes last.</P>
            <T
              head={["Category", "Fires on"]}
              rows={[
                ["SOURCE_UNAVAILABLE", "The repository or commit could not be cloned"],
                ["UNSUPPORTED_PROJECT", "No Dockerfile, pom.xml, Gradle build or package.json"],
                ["BUILD_TIMEOUT", "The build ran past its time limit"],
                ["PLATFORM_ERROR", "The container engine itself failed"],
                ["OUT_OF_MEMORY", "The process was killed for memory"],
                ["MISSING_START_SCRIPT", "A Node app with no start script"],
                ["DEPENDENCY_RESOLUTION", "Packages could not be downloaded or resolved"],
                ["COMPILATION_ERROR", "The code did not compile"],
                ["PORT_MISMATCH", "The app announces a different port than the project's"],
                ["HEALTH_PATH_NOT_FOUND", "The health path answered HTTP 404"],
                ["MISSING_CONFIGURATION", "Startup needs config it lacks: an environment variable or a database connection"],
                ["CRASH_ON_STARTUP", "The process exited during the health check"],
                ["CANARY_REGRESSION", "Healthy, but worse than live on real traffic"],
              ].map(([a, b]) => [<C key={a}>{a}</C>, b])}
            />
          </>
        ),
      },
      {
        id: "insight",
        title: "Reading an insight",
        body: (
          <CodeBlock
            lang="json"
            code={`GET /api/v1/deployments/{id}/insight
{
  "category": "PORT_MISMATCH",
  "summary": "The app listens on port 3000 but the project expects port 8080, so health checks could not reach it.",
  "suggestedFix": "Either change the project's port to 3000 in Settings, or make the app read the PORT environment variable (Forge sets PORT=8080).",
  "confidence": "HIGH", "engine": "rules",
  "evidence": ["Server listening on port 3000"]
}`}
          />
        ),
      },
    ],
  },
  {
    slug: "api-reference",
    group: "Reference",
    title: "API reference",
    description: "REST endpoints, conventions and error format of the Forge API (/api/v1).",
    sections: [
      {
        id: "conventions",
        title: "Conventions",
        body: (
          <UL
            items={[
              <>
                Base path <C>/api/v1</C>, JSON everywhere, Server-Sent Events for streams.
              </>,
              <>
                <C>Authorization: Bearer &lt;accessToken&gt;</C>. Stream endpoints also accept <C>?access_token=</C>, since{" "}
                <C>EventSource</C> cannot send headers.
              </>,
              <>
                Async operations answer <C>202 Accepted</C> with a <C>Location</C> header.
              </>,
              <>
                Pages: <C>?page=0&amp;size=20</C> → <C>{"{content, page, size, totalElements, totalPages}"}</C>.
              </>,
              <>
                Every response carries <C>X-Correlation-Id</C>. Another user&apos;s resource is a 404, never a 403.
              </>,
            ]}
          />
        ),
      },
      {
        id: "errors",
        title: "Errors",
        body: (
          <CodeBlock
            lang="json"
            code={`{
  "type": "https://forge.dev/errors/not-cancellable",
  "title": "Deployment can no longer be cancelled",
  "status": 409,
  "detail": "Deployment is HEALTH_CHECKING and can no longer be cancelled",
  "code": "NOT_CANCELLABLE",
  "correlationId": "c0a8012e-…"
}`}
          />
        ),
      },
      {
        id: "auth",
        title: "Auth",
        body: (
          <T
            head={["Endpoint", "Body", "Response"]}
            rows={[
              ["POST /auth/register", "{email, password (10–100), displayName}", "201 · 409 EMAIL_TAKEN"],
              ["POST /auth/login", "{email, password}", "200 {accessToken, refreshToken, expiresIn} · 401"],
              ["POST /auth/refresh", "{refreshToken}", "200 new pair · 401 (replay revokes all sessions)"],
              ["POST /auth/logout", "{refreshToken}", "204"],
              ["GET /me", "—", "200 {id, email, displayName}"],
            ].map((r) => [<C key={r[0]}>{r[0]}</C>, r[1], r[2]])}
          />
        ),
      },
      {
        id: "projects",
        title: "Projects and env",
        body: (
          <T
            head={["Endpoint", "Response"]}
            rows={[
              ["POST /projects", "201 Project · 409 SLUG_TAKEN · 400 VALIDATION_FAILED"],
              ["GET /projects", "Page<Project> (only your own)"],
              ["GET /projects/{id}", "Project · 404 if missing or not yours"],
              ["PATCH /projects/{id}", "Project (any field except slug)"],
              ["DELETE /projects/{id}", "204 (containers are stopped first)"],
              ["GET /projects/{id}/env", "[{key, valuePreview, updatedAt}]"],
              ["PUT /projects/{id}/env", "204 + X-Forge-Redeploy-Required"],
              ["DELETE /projects/{id}/env/{key}", "204"],
            ].map((r) => [<C key={r[0]}>{r[0]}</C>, r[1]])}
          />
        ),
      },
      {
        id: "deployments",
        title: "Deployments",
        body: (
          <T
            head={["Endpoint", "Response"]}
            rows={[
              ["POST /projects/{id}/deployments", "202 Deployment (QUEUED) · 422 REPOSITORY_UNREACHABLE"],
              ["GET /projects/{id}/deployments", "Page<Deployment>, newest first"],
              ["GET /deployments/{id}", "Deployment with timeline"],
              ["POST /deployments/{id}/cancel", "202 · 409 NOT_CANCELLABLE"],
              ["POST /deployments/{id}/rollback", "202 new Deployment · 422 NOT_ROLLBACKABLE"],
              ["GET /deployments/{id}/logs?after=0&limit=500", "[{seq, source, line, ts}]"],
              ["GET /deployments/{id}/logs/stream", "SSE: log, status, done"],
              ["GET /projects/{id}/runtime-logs/stream", "SSE log from the live container"],
              ["GET /deployments/{id}/insight", "Agent diagnosis, or 404 until ready"],
            ].map((r) => [<C key={r[0]}>{r[0]}</C>, r[1]])}
          />
        ),
      },
      {
        id: "github",
        title: "GitHub and webhooks",
        body: (
          <T
            head={["Endpoint", "Response"]}
            rows={[
              ["GET /github/connection", "{connected, login, oauthConfigured}"],
              ["POST /github/connect", "{authorizeUrl} · 503 GITHUB_OAUTH_NOT_CONFIGURED"],
              ["GET /github/repos", "[{owner, name, fullName, defaultBranch, isPrivate}]"],
              ["GET /github/repos/{owner}/{name}/branches", '["main", …]'],
              ["POST /webhooks/github", "202 accepted | duplicate | ignored · 401"],
            ].map((r) => [<C key={r[0]}>{r[0]}</C>, r[1]])}
          />
        ),
      },
      {
        id: "status-codes",
        title: "Status codes",
        body: (
          <T
            head={["Code", "Meaning in Forge"]}
            rows={[
              ["202", "Accepted for async processing (deploy, cancel, rollback, webhook)"],
              ["400", "Validation failed"],
              ["401", "Missing or invalid token, bad credentials, bad webhook signature"],
              ["404", "Not found or not yours"],
              ["409", "Conflict: taken, not cancellable, illegal transition, concurrent update"],
              ["422", "Repo unreachable, nothing to roll back to, GitHub not connected"],
              ["502 / 503", "External dependency failed, or the feature is not configured"],
            ].map((r) => [<C key={r[0]}>{r[0]}</C>, r[1]])}
          />
        ),
      },
    ],
  },
];

export function findDoc(slug: string) {
  return DOCS.find((d) => d.slug === slug);
}
