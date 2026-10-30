package com.forge.notification.application;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * @param enabled master switch
 * @param from sender address
 * @param dashboardUrl used to link from the message to the deployment page
 */
@ConfigurationProperties("forge.notifications")
public record NotificationProperties(
    @DefaultValue("true") boolean enabled,
    @DefaultValue("forge@localhost") String from,
    @DefaultValue("http://localhost:3000") String dashboardUrl) {}
