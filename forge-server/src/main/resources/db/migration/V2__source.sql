CREATE TABLE github_connections (
    id                UUID PRIMARY KEY,
    user_id           UUID         NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    github_user_id    BIGINT       NOT NULL,
    github_login      VARCHAR(100) NOT NULL,
    access_token_enc  BYTEA        NOT NULL,                     -- AES-256-GCM: iv || ciphertext || tag
    scopes            VARCHAR(255) NOT NULL,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE webhook_deliveries (
    delivery_id  VARCHAR(64) PRIMARY KEY,                       -- X-GitHub-Delivery → dedup key
    event_type   VARCHAR(50) NOT NULL,
    received_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
