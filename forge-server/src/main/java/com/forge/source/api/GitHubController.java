package com.forge.source.api;

import com.forge.shared.error.ForgeException;
import com.forge.shared.security.AuthenticatedUser;
import com.forge.source.application.GitHubAccountService;
import com.forge.source.application.GitHubAccountService.ConnectionStatus;
import com.forge.source.application.GitHubAccountService.RepositoryView;
import java.net.URI;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/github")
class GitHubController {

  private static final Logger log = LoggerFactory.getLogger(GitHubController.class);

  private final GitHubAccountService accounts;

  GitHubController(GitHubAccountService accounts) {
    this.accounts = accounts;
  }

  @GetMapping("/connection")
  ConnectionStatus connection(@AuthenticationPrincipal AuthenticatedUser user) {
    return accounts.status(user.id());
  }

  /** Returns the GitHub authorize URL; the dashboard then navigates the browser to it. */
  @PostMapping("/connect")
  Map<String, String> connect(@AuthenticationPrincipal AuthenticatedUser user) {
    return Map.of("authorizeUrl", accounts.authorizeUrl(user.id()));
  }

  /** GitHub redirects the browser here (no bearer token: the state identifies the user). */
  @GetMapping("/callback")
  ResponseEntity<Void> callback(@RequestParam String code, @RequestParam String state) {
    String result;
    try {
      accounts.completeConnection(code, state);
      result = "connected";
    } catch (ForgeException e) {
      log.warn("GitHub connection failed: {}", e.getMessage());
      result = "error";
    }
    URI target = URI.create(accounts.dashboardUrl() + "/settings?github=" + result);
    return ResponseEntity.status(HttpStatus.FOUND).location(target).build();
  }

  @DeleteMapping("/connection")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void disconnect(@AuthenticationPrincipal AuthenticatedUser user) {
    accounts.disconnect(user.id());
  }

  @GetMapping("/repos")
  List<RepositoryView> repos(@AuthenticationPrincipal AuthenticatedUser user) {
    return accounts.repositories(user.id());
  }

  @GetMapping("/repos/{owner}/{name}/branches")
  List<String> branches(
      @AuthenticationPrincipal AuthenticatedUser user,
      @PathVariable String owner,
      @PathVariable String name) {
    return accounts.branches(user.id(), owner, name);
  }
}
