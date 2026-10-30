package com.forge.source.infrastructure;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.forge.shared.error.ExternalServiceException;
import com.forge.source.application.GitHubProperties;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Adapter over the GitHub REST API and OAuth endpoints. Every failure is translated into an {@link
 * ExternalServiceException}, so no HTTP-library type leaks into the rest of the system.
 */
@Component
public class GitHubApiClient {

  private final RestClient api;
  private final RestClient oauth;
  private final GitHubProperties properties;

  GitHubApiClient(RestClient.Builder builder, GitHubProperties properties) {
    var timeouts = new SimpleClientHttpRequestFactory();
    timeouts.setConnectTimeout(5_000);
    timeouts.setReadTimeout(15_000);
    this.api =
        builder
            .clone()
            .requestFactory(timeouts)
            .baseUrl(properties.apiBaseUrl())
            .defaultHeader("Accept", "application/vnd.github+json")
            .defaultHeader("X-GitHub-Api-Version", "2022-11-28")
            .build();
    this.oauth =
        builder.clone().requestFactory(timeouts).baseUrl(properties.oauthBaseUrl()).build();
    this.properties = properties;
  }

  public OAuthToken exchangeCode(String code) {
    try {
      OAuthToken token =
          oauth
              .post()
              .uri("/login/oauth/access_token")
              .accept(MediaType.APPLICATION_JSON)
              .contentType(MediaType.APPLICATION_JSON)
              .body(
                  Map.of(
                      "client_id", properties.clientId(),
                      "client_secret", properties.clientSecret(),
                      "code", code,
                      "redirect_uri", properties.callbackUrl()))
              .retrieve()
              .body(OAuthToken.class);
      if (token == null || token.accessToken() == null) {
        throw new ExternalServiceException("GitHub did not return an access token", null);
      }
      return token;
    } catch (RestClientException e) {
      throw new ExternalServiceException("GitHub OAuth exchange failed", e);
    }
  }

  public GitHubUser currentUser(String token) {
    return get(token, "/user", GitHubUser.class);
  }

  public List<Repo> repositories(String token) {
    Repo[] repos = get(token, "/user/repos?per_page=100&sort=updated", Repo[].class);
    return repos == null ? List.of() : Arrays.asList(repos);
  }

  public List<String> branches(String token, String owner, String name) {
    Branch[] branches =
        get(token, "/repos/" + owner + "/" + name + "/branches?per_page=100", Branch[].class);
    return branches == null ? List.of() : Arrays.stream(branches).map(Branch::name).toList();
  }

  private <T> T get(String token, String uri, Class<T> type) {
    try {
      return api.get().uri(uri).header("Authorization", "Bearer " + token).retrieve().body(type);
    } catch (RestClientException e) {
      throw new ExternalServiceException("GitHub API call failed: " + uri, e);
    }
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record OAuthToken(
      @JsonProperty("access_token") String accessToken, @JsonProperty("scope") String scope) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record GitHubUser(long id, String login) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Repo(
      String name,
      @JsonProperty("full_name") String fullName,
      @JsonProperty("default_branch") String defaultBranch,
      @JsonProperty("private") boolean isPrivate,
      Owner owner) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Owner(String login) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  record Branch(String name) {}
}
