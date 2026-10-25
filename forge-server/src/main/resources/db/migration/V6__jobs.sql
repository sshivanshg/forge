CREATE TABLE jobs (
    id               UUID PRIMARY KEY,
    type             VARCHAR(30)  NOT NULL CHECK (type IN ('BUILD','DEPLOY','STOP')),
    payload          JSONB        NOT NULL,
    status           VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN ('PENDING','RUNNING','SUCCEEDED','FAILED','DEAD')),
    attempts         INT          NOT NULL DEFAULT 0,
    max_attempts     INT          NOT NULL DEFAULT 3,
    run_after        TIMESTAMPTZ  NOT NULL DEFAULT now(),        -- backoff scheduling
    locked_by        VARCHAR(100),
    locked_until     TIMESTAMPTZ,                                -- lease / visibility timeout
    last_error       TEXT,
    idempotency_key  VARCHAR(100) UNIQUE,                        -- e.g. 'build:<deploymentId>' → no duplicate jobs
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    finished_at      TIMESTAMPTZ
);
-- Partial index: the claim query only ever scans claimable rows → stays fast as history grows
CREATE INDEX ix_jobs_claimable ON jobs (run_after, created_at) WHERE status = 'PENDING';
CREATE INDEX ix_jobs_expired_lease ON jobs (locked_until) WHERE status = 'RUNNING';
