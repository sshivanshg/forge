package com.forge.deployment.application;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * @param healthTimeout how long a new instance has to become healthy before the deploy fails
 * @param drainDelay pause between the new instance going live and the old one being stopped, so the
 *     proxy has time to route to the new instance
 * @param busyRetryDelay when another deployment of the project is in progress, try again after this
 */
@ConfigurationProperties("forge.deploy")
public record DeploymentProperties(
    @DefaultValue("90s") Duration healthTimeout,
    @DefaultValue("3s") Duration drainDelay,
    @DefaultValue("15s") Duration busyRetryDelay) {}
