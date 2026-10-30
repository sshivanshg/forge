package com.forge.shared.config;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * Where deployed user apps are reachable.
 *
 * @param baseDomain apps live at {@code <slug>.<baseDomain>}; {@code localhost} locally
 * @param scheme http locally, https in production
 * @param publicPort port of the reverse proxy entrypoint; omitted from URLs when it is 80 or 443
 */
@Validated
@ConfigurationProperties("forge.apps")
public record AppsProperties(
    @NotBlank @DefaultValue("localhost") String baseDomain,
    @NotBlank @DefaultValue("http") String scheme,
    @DefaultValue("80") int publicPort) {}
