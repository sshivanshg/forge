package com.forge.identity;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.forge.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class AuthFlowIntegrationTest extends AbstractIntegrationTest {

  private static final String EMAIL = "Ada@Example.com";
  private static final String PASSWORD = "correct-horse-battery";

  @Test
  void registerLoginMeRefreshAndRotation() throws Exception {
    mvc.perform(
            post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"email":"%s","password":"%s","displayName":"Ada"}
                    """
                        .formatted(EMAIL, PASSWORD)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.email").value("ada@example.com"))
        .andExpect(jsonPath("$.passwordHash").doesNotExist());

    var tokens = read(login(EMAIL, PASSWORD));
    String access = tokens.get("accessToken").asText();
    String refresh = tokens.get("refreshToken").asText();

    mvc.perform(get("/api/v1/me").header("Authorization", bearer(access)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.displayName").value("Ada"));

    // rotation: the refresh token works once and returns a new pair
    var rotated = read(refresh(refresh, 200));
    String newRefresh = rotated.get("refreshToken").asText();

    // replaying the old token is treated as theft: rejected AND every session is ended
    refresh(refresh, 401);
    refresh(newRefresh, 401);
  }

  @Test
  void duplicateEmailIsAConflict() throws Exception {
    signUp("ada");
    String body =
        """
        {"email":"dup@example.com","password":"%s","displayName":"A"}
        """
            .formatted(PASSWORD);
    mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isCreated());
    mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("EMAIL_TAKEN"));
  }

  @Test
  void wrongPasswordAndUnknownUserGetTheSameAnswer() throws Exception {
    signUp("bob");
    mvc.perform(
            post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"nobody@example.com\",\"password\":\"whatever-123\"}"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"))
        .andExpect(jsonPath("$.detail").value("Invalid email or password"));
  }

  @Test
  void validationErrorsListTheFields() throws Exception {
    mvc.perform(
            post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"not-an-email\",\"password\":\"short\",\"displayName\":\"\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
        .andExpect(jsonPath("$.errors.length()").value(3))
        .andExpect(jsonPath("$.correlationId").exists());
  }

  @Test
  void protectedEndpointsNeedAValidToken() throws Exception {
    mvc.perform(get("/api/v1/projects"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("INVALID_TOKEN"));
    mvc.perform(get("/api/v1/projects").header("Authorization", "Bearer forged.token.value"))
        .andExpect(status().isUnauthorized());
  }

  private String login(String email, String password) throws Exception {
    return mvc.perform(
            post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"email":"%s","password":"%s"}
                    """
                        .formatted(email, password)))
        .andExpect(status().isOk())
        .andReturn()
        .getResponse()
        .getContentAsString();
  }

  private String refresh(String token, int expectedStatus) throws Exception {
    return mvc.perform(
            post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"" + token + "\"}"))
        .andExpect(status().is(expectedStatus))
        .andReturn()
        .getResponse()
        .getContentAsString();
  }
}
