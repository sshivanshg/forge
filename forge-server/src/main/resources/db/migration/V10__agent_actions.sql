-- Actions the Forge agent proposes. Nothing here runs until the project owner approves it.
CREATE TABLE agent_actions (
    id                    UUID PRIMARY KEY,
    project_id            UUID         NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    deployment_id         UUID         REFERENCES deployments (id) ON DELETE CASCADE, -- what prompted it
    type                  VARCHAR(20)  NOT NULL CHECK (type IN ('ROLLBACK','REDEPLOY','SCALE_OUT','UPDATE_SETTINGS')),
    status                VARCHAR(10)  NOT NULL CHECK (status IN ('PROPOSED','APPROVED','EXECUTED','REJECTED','FAILED','EXPIRED')),
    source                VARCHAR(30)  NOT NULL CHECK (source IN ('FAILURE_INVESTIGATION','HEALTH_WATCH','AUTO_CONFIGURE')),
    title                 VARCHAR(200) NOT NULL,
    rationale             TEXT         NOT NULL,
    -- the plan: which fields are set depends on the type
    target_deployment_id  UUID,
    commit_sha            VARCHAR(40),
    root_dir              VARCHAR(255),
    build_type            VARCHAR(20),
    port                  INTEGER CHECK (port BETWEEN 1 AND 65535),
    health_check_path     VARCHAR(255),
    replicas              INTEGER CHECK (replicas BETWEEN 1 AND 3),
    -- the outcome
    result_deployment_id  UUID,
    result_message        TEXT,
    decided_by            UUID,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    decided_at            TIMESTAMPTZ,
    version               BIGINT       NOT NULL DEFAULT 0
);

CREATE INDEX ix_agent_actions_project ON agent_actions (project_id, created_at DESC);

-- The agent never stacks up duplicates: one open proposal per project and action type.
CREATE UNIQUE INDEX ux_agent_actions_one_open ON agent_actions (project_id, type)
    WHERE status IN ('PROPOSED','APPROVED');
