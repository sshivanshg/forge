package com.forge.source.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.forge.shared.error.ErrorCode;
import com.forge.shared.error.ForgeException;
import com.forge.shared.error.ValidationException;
import com.forge.source.GitPushReceived;
import com.forge.source.domain.WebhookDelivery;
import com.forge.source.infrastructure.WebhookDeliveryRepository;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Handles GitHub webhooks: verify the HMAC signature, drop duplicate deliveries, and turn a push
 * into a {@link GitPushReceived} domain event.
 */
@Service
public class WebhookService {

  private static final Logger log = LoggerFactory.getLogger(WebhookService.class);
  private static final String ZERO_SHA = "0000000000000000000000000000000000000000";
  private static final String BRANCH_PREFIX = "refs/heads/";

  private final WebhookDeliveryRepository deliveries;
  private final ApplicationEventPublisher events;
  private final ObjectMapper objectMapper;
  private final GitHubProperties properties;
  private final Clock clock;

  public WebhookService(
      WebhookDeliveryRepository deliveries,
      ApplicationEventPublisher events,
      ObjectMapper objectMapper,
      GitHubProperties properties,
      Clock clock) {
    this.deliveries = deliveries;
    this.events = events;
    this.objectMapper = objectMapper;
    this.properties = properties;
    this.clock = clock;
  }

  @Transactional
  public Outcome handle(String event, String deliveryId, String signature, byte[] body) {
    verifySignature(signature, body);
    if (deliveryId == null || deliveryId.isBlank()) {
      throw new ValidationException("Missing X-GitHub-Delivery header");
    }
    if (deliveries.existsById(deliveryId)) {
      return Outcome.DUPLICATE;
    }
    deliveries.save(new WebhookDelivery(deliveryId, event, clock.instant()));
    if (!"push".equals(event)) {
      return Outcome.IGNORED;
    }
    JsonNode push = parse(body);
    String ref = push.path("ref").asText();
    String after = push.path("after").asText();
    if (!ref.startsWith(BRANCH_PREFIX)
        || ZERO_SHA.equals(after)
        || push.path("deleted").asBoolean()) {
      return Outcome.IGNORED; // tag push or branch deletion: nothing to deploy
    }
    JsonNode repository = push.path("repository");
    String owner = repository.path("owner").path("login").asText(null);
    if (owner == null) {
      owner = repository.path("owner").path("name").asText();
    }
    var pushEvent =
        new GitPushReceived(
            owner,
            repository.path("name").asText(),
            ref.substring(BRANCH_PREFIX.length()),
            after,
            firstLine(push.path("head_commit").path("message").asText("")));
    log.info("Push to {}/{}@{} ({})", owner, pushEvent.repoName(), pushEvent.branch(), after);
    events.publishEvent(pushEvent);
    return Outcome.ACCEPTED;
  }

  /** Constant-time comparison so the signature cannot be guessed byte by byte. */
  void verifySignature(String signatureHeader, byte[] body) {
    if (!properties.webhookConfigured()) {
      throw new ForgeException(
          ErrorCode.INVALID_WEBHOOK_SIGNATURE, "Webhook secret is not configured on this server");
    }
    String expected = "sha256=" + hmacSha256Hex(properties.webhookSecret(), body);
    if (signatureHeader == null
        || !MessageDigest.isEqual(
            expected.getBytes(StandardCharsets.UTF_8),
            signatureHeader.getBytes(StandardCharsets.UTF_8))) {
      throw new ForgeException(ErrorCode.INVALID_WEBHOOK_SIGNATURE, "Signature mismatch");
    }
  }

  static String hmacSha256Hex(String secret, byte[] body) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      return HexFormat.of().formatHex(mac.doFinal(body));
    } catch (NoSuchAlgorithmException | InvalidKeyException e) {
      throw new IllegalStateException(e);
    }
  }

  private JsonNode parse(byte[] body) {
    try {
      return objectMapper.readTree(body);
    } catch (IOException e) {
      throw new ValidationException("Webhook body is not valid JSON");
    }
  }

  private static String firstLine(String message) {
    int newline = message.indexOf('\n');
    String line = newline < 0 ? message : message.substring(0, newline);
    return line.length() > 500 ? line.substring(0, 500) : line;
  }

  public enum Outcome {
    ACCEPTED,
    DUPLICATE,
    IGNORED
  }
}
