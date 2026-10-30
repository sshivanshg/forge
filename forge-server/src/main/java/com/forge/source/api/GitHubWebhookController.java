package com.forge.source.api;

import com.forge.source.application.WebhookService;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public endpoint GitHub calls on every push. Authenticated by the HMAC signature instead of a JWT.
 * It answers fast with 202: the real work happens asynchronously in the job queue.
 */
@RestController
class GitHubWebhookController {

  private final WebhookService webhooks;

  GitHubWebhookController(WebhookService webhooks) {
    this.webhooks = webhooks;
  }

  @PostMapping("/api/v1/webhooks/github")
  @ResponseStatus(HttpStatus.ACCEPTED)
  Map<String, String> receive(
      @RequestHeader(value = "X-GitHub-Event", defaultValue = "") String event,
      @RequestHeader(value = "X-GitHub-Delivery", required = false) String deliveryId,
      @RequestHeader(value = "X-Hub-Signature-256", required = false) String signature,
      @RequestBody byte[] body) {
    var outcome = webhooks.handle(event, deliveryId, signature, body);
    return Map.of("result", outcome.name().toLowerCase());
  }
}
