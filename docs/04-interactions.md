# 04 — Sequence and Activity Diagrams

> Rubric item 6: flow of control for the core use cases and how objects interact. Participant names are the real classes.

## 1. Sequence: Deploy a commit (UC5)

### 1a. Request (synchronous, milliseconds)

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer
    participant UI as Dashboard
    participant C as DeploymentController
    participant S as DeploymentService
    participant PC as ProjectCatalog
    participant SRC as SourceCodeProvider
    participant T as DeploymentTransitions
    participant D as Deployment
    participant Q as JobQueue
    participant DB as PostgreSQL

    Dev->>UI: click Deploy
    UI->>C: POST /projects/{id}/deployments (Bearer JWT)
    C->>S: request(projectId, userId, null)
    S->>PC: getOwned(projectId, userId)
    PC-->>S: ProjectSnapshot (or 404 if not the owner)
    S->>SRC: resolveHead(repo, branch, token)
    SRC-->>S: commit SHA (git ls-remote)
    S->>T: queue(project, sha, MANUAL, user)
    activate T
    Note over T,DB: one database transaction
    T->>DB: cancel older QUEUED deployments of the project
    T->>D: Deployment.request(...) → QUEUED + event
    T->>DB: INSERT deployment
    T->>DB: INSERT deployment_event (audit listener)
    T->>Q: enqueue(BUILD, {deploymentId}, "build:id")
    Q->>DB: INSERT job ... ON CONFLICT DO NOTHING
    deactivate T
    S-->>C: DeploymentView
    C-->>UI: 202 Accepted + Location
    UI->>C: GET /deployments/{id}/logs/stream (SSE)
```

### 1b. Build job (asynchronous, minutes)

```mermaid
sequenceDiagram
    autonumber
    participant R as JobRunner
    participant Q as PostgresJobQueue
    participant H as BuildJobHandler
    participant T as DeploymentTransitions
    participant B as DefaultBuildService
    participant G as JGitSourceCodeProvider
    participant DC as DetectorChain
    participant F as BuildStrategyFactory
    participant I as RetryingImageBuilder
    participant L as LogSink
    participant UI as Browser (SSE)

    loop every 2 s while permits are free
        R->>Q: claim(workerId, lease)
    end
    Q-->>R: Job(BUILD)
    R->>H: handle(job) [virtual thread + heartbeat]
    H->>T: beginBuild(id)
    T-->>H: QUEUED → BUILDING (or postpone if the project is busy)
    H->>B: build(BuildRequest)
    B->>G: checkout(repo, branch, sha, workspace)
    B->>DC: detect(contextDir)
    DC-->>B: MAVEN / NODE / GRADLE / DOCKERFILE
    B->>F: forType(type).prepare(dir, port)
    F-->>B: Dockerfile path
    B->>I: build(...) then push(...)
    I->>L: every output line
    L-->>UI: event "log"
    B-->>H: BuildResult(imageRef, commit)
    H->>T: completeBuild(id, imageRef, message)
    Note over T: one transaction: BUILDING → DEPLOYING + enqueue DEPLOY job
    R->>Q: complete(jobId)
```

### 1c. Deploy job: blue-green rollout

```mermaid
sequenceDiagram
    autonumber
    participant H as DeployJobHandler
    participant T as DeploymentTransitions
    participant BG as BlueGreenRollout
    participant RT as DockerRuntimeProvider
    participant HP as HttpHealthProbe
    participant TR as Traefik
    participant UI as Browser (SSE)

    H->>T: beginDeploy(id)
    H->>BG: rollout(context with decrypted env)
    BG->>RT: start(ContainerSpec) → green
    RT-->>BG: RunningInstance(id, http://127.0.0.1:port)
    BG->>T: recordInstance + beginHealthCheck
    loop every 2 s up to 90 s, stop early if the container exits
        BG->>HP: GET /health
    end
    alt healthy
        BG->>RT: promote(green) (restart policy: unless-stopped)
        BG->>T: goLive(id): LIVE, previous → SUPERSEDED, project.liveDeploymentId
        TR->>TR: green passes the Traefik health check and receives traffic
        BG->>RT: stop(blue) after a 3 s drain
        T-->>UI: status LIVE, done
    else unhealthy
        BG->>RT: recentOutput(green) → RUNTIME log lines
        BG->>RT: stop(green)
        BG->>T: fail(id, UNHEALTHY, detail)
        Note over TR: blue was never touched, so the site stays up
        T-->>UI: status FAILED, done
    end
```

## 2. Sequence: Failure diagnosis by the agent (UC13)

```mermaid
sequenceDiagram
    autonumber
    participant T as DeploymentTransitions
    participant EV as Spring events
    participant FI as FailureInvestigator
    participant DQ as DeploymentQueries
    participant LR as LogReader
    participant SR as SecretRedactor
    participant CE as ClaudeDiagnosisEngine
    participant RE as RuleBasedDiagnosisEngine
    participant DB as deployment_insights

    T->>EV: DeploymentStatusChanged(to = FAILED)
    EV->>FI: after commit, async: onDeploymentFailed
    FI->>DQ: get(deploymentId)
    FI->>LR: tail(deploymentId, 150)
    FI->>SR: redact(lines, env values)
    FI->>CE: diagnose(FailureContext)
    alt API key set and the call succeeds
        CE-->>FI: Diagnosis (JSON parsed)
    else no key or any error
        CE-->>FI: empty
        FI->>RE: diagnose(FailureContext)
        RE-->>FI: first matching rule (e.g. PORT_MISMATCH)
    end
    FI->>DB: save Insight
    FI->>FI: append the 🤖 summary to the deployment log
```

## 3. Sequence: Auto-deploy from a GitHub push (UC6)

```mermaid
sequenceDiagram
    autonumber
    participant GH as GitHub
    participant WC as GitHubWebhookController
    participant WS as WebhookService
    participant DB as PostgreSQL
    participant DS as DeploymentService
    participant T as DeploymentTransitions

    GH->>WC: POST /webhooks/github (X-Hub-Signature-256, X-GitHub-Delivery)
    WC->>WS: handle(event, deliveryId, signature, body)
    Note over WS,T: one transaction
    WS->>WS: verify HMAC-SHA256 (constant time) → 401 if wrong
    WS->>DB: delivery seen before? → "duplicate"
    WS->>DB: INSERT webhook_delivery
    WS->>DS: publish GitPushReceived (synchronous listener)
    DS->>DB: findAutoDeployTargets(owner, repo, branch)
    loop each matching project
        DS->>T: queue(project, sha, message, WEBHOOK)
    end
    WC-->>GH: 202 {"result":"accepted"}
```

## 4. Sequence: Login and refresh-token rotation (UC1)

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant AC as AuthController
    participant AS as AuthService
    participant PE as BCryptPasswordEncoder
    participant JS as JwtService
    participant RT as refresh_tokens

    U->>AC: POST /auth/login
    AC->>AS: login(email, password)
    AS->>PE: matches(password, hash or a dummy hash)
    alt wrong email or password
        AS-->>AC: 401 "Invalid email or password" (same for both)
    else ok
        AS->>JS: issueAccessToken (HS256, 15 min)
        AS->>RT: save SHA-256(random refresh token)
        AC-->>U: accessToken + refreshToken
    end
    Note over U,RT: 15 minutes later
    U->>AC: POST /auth/refresh (old token)
    AC->>AS: refresh(token)
    alt token already revoked (replay = likely theft)
        AS->>RT: revoke ALL sessions of the user
        AS-->>AC: 401
    else valid
        AS->>RT: revoke the old token, store a new one
        AC-->>U: new pair
    end
```

## 5. Sequence: Roll back (UC9)

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer
    participant C as DeploymentController
    participant S as DeploymentService
    participant T as DeploymentTransitions
    participant D as Deployment
    participant Q as JobQueue
    participant H as DeployJobHandler

    Dev->>C: POST /deployments/{old}/rollback
    C->>S: rollback(old, user)
    S->>T: queueRollback(old, user)
    T->>D: Deployment.rollbackTo(old) (copies imageRef, trigger ROLLBACK)
    T->>Q: enqueue(DEPLOY) (no BUILD job)
    C-->>Dev: 202 new deployment
    H->>T: beginDeploy: QUEUED → DEPLOYING
    Note over H: then the same blue-green rollout as section 1c
```

## 6. Activity: Deployment lifecycle

```mermaid
flowchart TD
    start([Deploy requested]) --> pin[Resolve branch head to exact SHA]
    pin --> rec[Record QUEUED + BUILD job<br/>cancel older queued]
    rec --> wait[Wait in queue]
    wait --> claim{Worker claims job}
    claim --> cancelled{Still QUEUED?}
    cancelled -- no, cancelled --> stopA([End: CANCELLED])
    cancelled -- yes --> busy{Another deploy<br/>of project in progress?}
    busy -- yes --> postpone[Postpone 15 s<br/>attempt not used] --> wait
    busy -- no --> building[BUILDING: clone, detect, build, push]
    building --> buildok{Build ok?}
    buildok -- no --> failB[FAILED: BUILD_FAILED / TIMEOUT /<br/>SOURCE_UNAVAILABLE / PUSH_FAILED]
    buildok -- yes --> stillb{Cancelled during build?}
    stillb -- yes --> stopB([Discard image])
    stillb -- no --> deploying[DEPLOYING + DEPLOY job]
    deploying --> start2[Start green container]
    start2 --> startok{Started?}
    startok -- "no (Docker error)" --> retry{Attempts left?}
    retry -- yes --> backoff[Retry with backoff] --> start2
    retry -- no --> failR[FAILED: RUNTIME_ERROR]
    startok -- yes --> hc[HEALTH_CHECKING: poll health path]
    hc --> healthy{Healthy within 90 s?}
    healthy -- no --> rej[Capture output, remove green] --> failU[FAILED: UNHEALTHY<br/>blue keeps serving]
    healthy -- yes --> live[LIVE, previous SUPERSEDED] --> drain[Drain 3 s, stop blue] --> done([End: LIVE + email])
    failB --> agent[🤖 Agent diagnoses] --> endF([End: FAILED + email])
    failR --> agent
    failU --> agent
```

## 7. Activity: Job worker loop (one `JobRunner` instance)

```mermaid
flowchart TD
    tick([Every 2 s]) --> permit{Free permit?}
    permit -- no --> tick
    permit -- yes --> claim[claim: FOR UPDATE SKIP LOCKED]
    claim --> got{Job found?}
    got -- no --> release[Release permit] --> tick
    got -- yes --> spawn[Run on a virtual thread<br/>start heartbeat]
    spawn --> handle[handler.handle job]
    handle --> outcome{Outcome}
    outcome -- success --> complete[status SUCCEEDED]
    outcome -- JobPostponed --> post[status PENDING, run_after += delay, attempts - 1]
    outcome -- "error, retryable, attempts left" --> retry[status PENDING, run_after += 10s·2^n]
    outcome -- "error, otherwise" --> dead[status FAILED / DEAD<br/>handler.onExhausted → deployment FAILED]
    complete & post & retry & dead --> stop[Stop heartbeat, release permit] --> tick
    reaper([Every 60 s: reaper]) --> expired{RUNNING with<br/>expired lease?}
    expired -- "attempts left" --> requeue[back to PENDING]
    expired -- "no attempts" --> dead2[DEAD + onExhausted]
```

## 8. Activity: Webhook handling

```mermaid
flowchart TD
    a([POST /webhooks/github]) --> sig{Signature valid?}
    sig -- no --> r401([401 INVALID_WEBHOOK_SIGNATURE])
    sig -- yes --> dup{Delivery id seen?}
    dup -- yes --> rdup([202 duplicate])
    dup -- no --> save[Store delivery id]
    save --> push{Event = push to a branch,<br/>not a deletion?}
    push -- no --> rign([202 ignored])
    push -- yes --> match[Find auto-deploy projects<br/>for repo + branch]
    match --> each[Queue a WEBHOOK deployment for each] --> racc([202 accepted])
```
