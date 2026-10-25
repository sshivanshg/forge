package com.forge.source.application;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * @param clientId GitHub OAuth app client id (empty = GitHub connection disabled)
 * @param clientSecret GitHub OAuth app secret
 * @param webhookSecret shared secret used to sign push webhooks
 * @param callbackUrl OAuth redirect URI registered on the OAuth app
 * @param dashboardUrl where the browser is sent back to after connecting
 * @param gitBaseUrl clone base URL; {@code https://github.com}, or a {@code file://} folder of bare
 *     repositories for offline demos and tests
 * @param apiBaseUrl GitHub REST API base URL
 * @param oauthBaseUrl GitHub OAuth endpoints base URL
 */
@ConfigurationProperties("forge.github")
public record GitHubProperties(
    String clientId,
    String clientSecret,
    String webhookSecret,
    String callbackUrl,
    @DefaultValue("http://localhost:3000") String dashboardUrl,
    @DefaultValue("https://github.com") String gitBaseUrl,
    @DefaultValue("https://api.github.com") String apiBaseUrl,
    @DefaultValue("https://github.com") String oauthBaseUrl) {

  public boolean oauthConfigured() {
    return clientId != null
        && !clientId.isBlank()
        && clientSecret != null
        && !clientSecret.isBlank();
  }

  public boolean webhookConfigured() {
    return webhookSecret != null && !webhookSecret.isBlank();
  }
}
