-- Replicas: a project runs 1 to 3 identical instances behind the load balancer.
-- Rollout strategy: BLUE_GREEN switches all traffic at once; CANARY shifts it in steps and
-- rolls back on its own when the new version's error rate or latency gets worse.
ALTER TABLE projects
    ADD COLUMN replicas INT NOT NULL DEFAULT 1 CHECK (replicas BETWEEN 1 AND 3),
    ADD COLUMN rollout_strategy VARCHAR(20) NOT NULL DEFAULT 'BLUE_GREEN'
        CHECK (rollout_strategy IN ('BLUE_GREEN', 'CANARY'));

-- A deployment now owns one container per replica.
ALTER TABLE runtime_instances DROP CONSTRAINT runtime_instances_deployment_id_key;
ALTER TABLE runtime_instances ADD COLUMN replica INT NOT NULL DEFAULT 0;
ALTER TABLE runtime_instances
    ADD CONSTRAINT ux_runtime_instances_replica UNIQUE (deployment_id, replica);

-- CANARY: healthy, serving a share of the traffic while Forge compares it with the live version.
ALTER TABLE deployments DROP CONSTRAINT deployments_status_check;
ALTER TABLE deployments
    ADD CONSTRAINT deployments_status_check CHECK (status IN
        ('QUEUED', 'BUILDING', 'DEPLOYING', 'HEALTH_CHECKING', 'CANARY', 'LIVE',
         'FAILED', 'CANCELLED', 'SUPERSEDED', 'STOPPED'));
ALTER TABLE deployments ADD COLUMN traffic_percent INT CHECK (traffic_percent BETWEEN 0 AND 100);

DROP INDEX ux_deployments_one_active;
CREATE UNIQUE INDEX ux_deployments_one_active ON deployments (project_id)
    WHERE status IN ('BUILDING', 'DEPLOYING', 'HEALTH_CHECKING', 'CANARY');
