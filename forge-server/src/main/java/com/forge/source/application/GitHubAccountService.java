package com.forge.source.application;

import com.forge.shared.crypto.EncryptionService;
import com.forge.shared.error.ErrorCode;
import com.forge.shared.error.ForgeException;
import com.forge.source.GitHubAccounts;
import com.forge.source.domain.GitHubConnection;
import com.forge.source.infrastructure.GitHubApiClient;
import com.forge.source.infrastructure.GitHubApiClient.Repo;
import com.forge.source.infrastructure.GitHubConnectionRepository;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Connecting a GitHub account (OAuth authorization-code flow) and browsing its repositories. */
@Service
public class GitHubAccountService implements GitHubAccounts {

  private final GitHubConnectionRepository connections;
  private final GitHubApiClient github;
  private final OAuthStateStore states;
  private final EncryptionService encryption;
  private final GitHubProperties properties;
  private final Clock clock;

  public GitHubAccountService(
      GitHubConnectionRepository connections,
      GitHubApiClient github,
      OAuthStateStore states,
      EncryptionService encryption,
      GitHubProperties properties,
      Clock clock) {
    this.connections = connections;
    this.github = github;
    this.states = states;
    this.encryption = encryption;
    this.properties = properties;
    this.clock = clock;
  }

  /** Step 1: the URL the browser is sent to, carrying a fresh single-use state. */
  public String authorizeUrl(UUID userId) {
    requireOAuthConfigured();
    return properties.oauthBaseUrl()
        + "/login/oauth/authorize?client_id="
        + encode(properties.clientId())
        + "&redirect_uri="
        + encode(properties.callbackUrl())
        + "&scope="
        + encode("repo read:user")
        + "&state="
        + encode(states.issue(userId));
  }

  /** Step 2: GitHub redirected back with a code; exchange it and store the token encrypted. */
  @Transactional
  public void completeConnection(String code, String state) {
    requireOAuthConfigured();
    UUID userId =
        states
            .consume(state)
            .orElseThrow(
                () ->
                    new ForgeException(ErrorCode.INVALID_TOKEN, "OAuth state invalid or expired"));
    GitHubApiClient.OAuthToken token = github.exchangeCode(code);
    GitHubApiClient.GitHubUser user = github.currentUser(token.accessToken());
    byte[] encrypted = encryption.encrypt(token.accessToken());
    connections
        .findByUser(userId)
        .ifPresentOrElse(
            existing -> existing.relink(user.id(), user.login(), encrypted, token.scope()),
            () ->
                connections.save(
                    new GitHubConnection(
                        userId,
                        user.id(),
                        user.login(),
                        encrypted,
                        token.scope(),
                        clock.instant())));
  }

  @Transactional(readOnly = true)
  public ConnectionStatus status(UUID userId) {
    Optional<GitHubConnection> connection = connections.findByUser(userId);
    return new ConnectionStatus(
        connection.isPresent(),
        connection.map(GitHubConnection::githubLogin).orElse(null),
        properties.oauthConfigured());
  }

  @Transactional
  public void disconnect(UUID userId) {
    connections.findByUser(userId).ifPresent(connections::delete);
  }

  public List<RepositoryView> repositories(UUID userId) {
    String token = requireToken(userId);
    return github.repositories(token).stream()
        .map(
            (Repo r) ->
                new RepositoryView(
                    r.owner().login(), r.name(), r.fullName(), r.defaultBranch(), r.isPrivate()))
        .toList();
  }

  public List<String> branches(UUID userId, String owner, String name) {
    return github.branches(requireToken(userId), owner, name);
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<String> accessTokenFor(UUID userId) {
    return connections.findByUser(userId).map(c -> encryption.decrypt(c.encryptedAccessToken()));
  }

  public String dashboardUrl() {
    return properties.dashboardUrl();
  }

  private String requireToken(UUID userId) {
    return accessTokenFor(userId)
        .orElseThrow(
            () ->
                new ForgeException(
                    ErrorCode.GITHUB_NOT_CONNECTED, "Connect your GitHub account first"));
  }

  private void requireOAuthConfigured() {
    if (!properties.oauthConfigured()) {
      throw new ForgeException(
          ErrorCode.GITHUB_OAUTH_NOT_CONFIGURED,
          "Set FORGE_GITHUB_CLIENT_ID and FORGE_GITHUB_CLIENT_SECRET to enable GitHub login");
    }
  }

  private static String encode(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8);
  }

  public record ConnectionStatus(boolean connected, String login, boolean oauthConfigured) {}

  public record RepositoryView(
      String owner, String name, String fullName, String defaultBranch, boolean isPrivate) {}
}
