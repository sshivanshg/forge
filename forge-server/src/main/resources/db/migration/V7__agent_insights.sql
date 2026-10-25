-- The Forge agent's diagnosis of a failed deployment (one per deployment).
CREATE TABLE deployment_insights (
    deployment_id  UUID PRIMARY KEY REFERENCES deployments (id) ON DELETE CASCADE,
    category       VARCHAR(40)  NOT NULL,                       -- e.g. PORT_MISMATCH, COMPILE_ERROR
    summary        TEXT         NOT NULL,
    suggested_fix  TEXT         NOT NULL,
    confidence     VARCHAR(10)  NOT NULL CHECK (confidence IN ('LOW','MEDIUM','HIGH')),
    engine         VARCHAR(100) NOT NULL,                       -- 'rules' or the LLM model id
    evidence       TEXT,                                        -- log lines the diagnosis is based on
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
