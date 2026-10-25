package com.forge.source;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.forge.support.AbstractIntegrationTest;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class WebhookIntegrationTest extends AbstractIntegrationTest {

  private static final String SECRET = "test-webhook-secret"; // matches application-test.yml
  private static final String SHA = "0123456789abcdef0123456789abcdef01234567";

  @BeforeEach
  void autoDeployProject() throws Exception {
    String token = signUp("owner");
    mvc.perform(
            post("/api/v1/projects")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"name\":\"Hooked\",\"repoOwner\":\"Demo\",\"repoName\":\"hello-node\",\"branch\":\"main\"}"))
        .andExpect(status().isCreated());
  }

  @Test
  void signedPushQueuesADeploymentOnce() throws Exception {
    String body = push("refs/heads/main");

    send(body, sign(body), "delivery-1").andExpect(status().isAccepted()).andExpect(jsonPath("$.result").value("accepted"));
    // GitHub retries deliveries: the same delivery id must not deploy twice
    send(body, sign(body), "delivery-1").andExpect(jsonPath("$.result").value("duplicate"));

    assertThat(jdbc.queryForObject("select count(*) from deployments where trigger = 'WEBHOOK'", Integer.class))
        .isEqualTo(1);
    assertThat(jdbc.queryForObject("select commit_message from deployments", String.class))
        .isEqualTo("fix: typo");
  }

  @Test
  void pushToAnotherBranchDeploysNothing() throws Exception {
    String body = push("refs/heads/feature-x");
    send(body, sign(body), "delivery-2").andExpect(status().isAccepted());
    assertThat(jdbc.queryForObject("select count(*) from deployments", Integer.class)).isZero();
  }

  @Test
  void forgedSignatureIsRejected() throws Exception {
    String body = push("refs/heads/main");
    send(body, "sha256=" + "0".repeat(64), "delivery-3")
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("INVALID_WEBHOOK_SIGNATURE"));
    send(body, null, "delivery-4").andExpect(status().isUnauthorized());
    assertThat(jdbc.queryForObject("select count(*) from webhook_deliveries", Integer.class)).isZero();
  }

  private org.springframework.test.web.servlet.ResultActions send(String body, String signature, String delivery)
      throws Exception {
    var request =
        post("/api/v1/webhooks/github")
            .contentType(MediaType.APPLICATION_JSON)
            .header("X-GitHub-Event", "push")
            .header("X-GitHub-Delivery", delivery)
            .content(body);
    if (signature != null) {
      request.header("X-Hub-Signature-256", signature);
    }
    return mvc.perform(request);
  }

  private static String push(String ref) {
    return """
        {"ref":"%s","after":"%s","deleted":false,
         "head_commit":{"message":"fix: typo\\n\\nlonger body"},
         "repository":{"name":"hello-node","owner":{"login":"demo"}}}
        """
        .formatted(ref, SHA);
  }

  private static String sign(String body) throws Exception {
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    return "sha256=" + HexFormat.of().formatHex(mac.doFinal(body.getBytes(StandardCharsets.UTF_8)));
  }
}
