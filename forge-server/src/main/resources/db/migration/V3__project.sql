CREATE TABLE projects (
    id                  UUID PRIMARY KEY,
    owner_id            UUID         NOT NULL REFERENCES users (id),
    name                VARCHAR(100) NOT NULL,
    slug                VARCHAR(63)  NOT NULL UNIQUE             -- becomes the subdomain → DNS label rules
                        CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
    repo_owner          VARCHAR(100) NOT NULL,
    repo_name           VARCHAR(100) NOT NULL,
    branch              VARCHAR(255) NOT NULL DEFAULT 'main',
    root_dir            VARCHAR(255) NOT NULL DEFAULT '.',
    build_type          VARCHAR(20)  NOT NULL DEFAULT 'AUTO'
                        CHECK (build_type IN ('AUTO','DOCKERFILE','MAVEN','GRADLE','NODE')),
    port                INT          NOT NULL DEFAULT 8080 CHECK (port BETWEEN 1 AND 65535),
    health_check_path   VARCHAR(255) NOT NULL DEFAULT '/',
    auto_deploy         BOOLEAN      NOT NULL DEFAULT TRUE,
    live_deployment_id  UUID,                                    -- FK added in V4 (circular reference)
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX ix_projects_owner ON projects (owner_id);
CREATE INDEX ix_projects_repo  ON projects (repo_owner, repo_name, branch);   -- webhook lookup

CREATE TABLE environment_variables (
    id          UUID PRIMARY KEY,
    project_id  UUID         NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    key         VARCHAR(255) NOT NULL CHECK (key ~ '^[A-Za-z_][A-Za-z0-9_]*$'),
    value_enc   BYTEA        NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (project_id, key)
);
