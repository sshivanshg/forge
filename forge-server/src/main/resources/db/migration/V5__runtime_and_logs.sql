CREATE TABLE runtime_instances (
    id             UUID PRIMARY KEY,
    deployment_id  UUID         NOT NULL UNIQUE REFERENCES deployments (id) ON DELETE CASCADE,
    kind           VARCHAR(20)  NOT NULL CHECK (kind IN ('DOCKER','KUBERNETES')),
    external_id    VARCHAR(255) NOT NULL,                        -- container id / k8s deployment name
    internal_url   VARCHAR(500) NOT NULL,                        -- where Forge probes health
    status         VARCHAR(20)  NOT NULL CHECK (status IN ('STARTING','RUNNING','STOPPED')),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    stopped_at     TIMESTAMPTZ
);

CREATE TABLE log_lines (
    id             BIGSERIAL PRIMARY KEY,
    deployment_id  UUID        NOT NULL REFERENCES deployments (id) ON DELETE CASCADE,
    source         VARCHAR(10) NOT NULL CHECK (source IN ('BUILD','DEPLOY','RUNTIME','SYSTEM')),
    seq            INT         NOT NULL,                         -- client resumes with ?after=seq
    line           TEXT        NOT NULL,
    ts             TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (deployment_id, seq)
);
-- Retention: a scheduled job deletes BUILD logs older than 30 days. Runtime logs are streamed, not stored, in M1.
