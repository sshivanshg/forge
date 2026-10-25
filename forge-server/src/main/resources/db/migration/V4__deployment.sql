CREATE TABLE deployments (
    id              UUID PRIMARY KEY,
    project_id      UUID         NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    commit_sha      CHAR(40)     NOT NULL,
    commit_message  VARCHAR(500),
    trigger         VARCHAR(20)  NOT NULL CHECK (trigger IN ('MANUAL','WEBHOOK','ROLLBACK')),
    status          VARCHAR(20)  NOT NULL CHECK (status IN
                    ('QUEUED','BUILDING','DEPLOYING','HEALTH_CHECKING','LIVE',
                     'FAILED','CANCELLED','SUPERSEDED','STOPPED')),
    failure_reason  VARCHAR(30),
    failure_detail  TEXT,
    image_ref       VARCHAR(500),
    rollback_of_id  UUID REFERENCES deployments (id),
    triggered_by    UUID REFERENCES users (id),                  -- NULL for webhooks
    version         BIGINT       NOT NULL DEFAULT 0,             -- optimistic locking (@Version)
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ
);
CREATE INDEX ix_deployments_project_created ON deployments (project_id, created_at DESC);  -- history page

-- At most ONE deployment per project may be actively in the pipeline (FR-11). Enforced by the DB, not just code.
CREATE UNIQUE INDEX ux_deployments_one_active ON deployments (project_id)
    WHERE status IN ('BUILDING','DEPLOYING','HEALTH_CHECKING');

ALTER TABLE projects
    ADD CONSTRAINT fk_projects_live_deployment FOREIGN KEY (live_deployment_id) REFERENCES deployments (id);

CREATE TABLE deployment_events (
    id             BIGSERIAL PRIMARY KEY,
    deployment_id  UUID        NOT NULL REFERENCES deployments (id) ON DELETE CASCADE,
    from_status    VARCHAR(20),
    to_status      VARCHAR(20) NOT NULL,
    message        TEXT,
    occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_deployment_events_deployment ON deployment_events (deployment_id, id);
