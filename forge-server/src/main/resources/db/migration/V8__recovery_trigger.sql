-- Self-healing: a RECOVERY deployment restarts the live image when its container has disappeared.
ALTER TABLE deployments DROP CONSTRAINT deployments_trigger_check;
ALTER TABLE deployments
    ADD CONSTRAINT deployments_trigger_check
        CHECK (trigger IN ('MANUAL', 'WEBHOOK', 'ROLLBACK', 'RECOVERY'));
