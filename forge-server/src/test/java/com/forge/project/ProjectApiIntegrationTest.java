package com.forge.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.forge.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class ProjectApiIntegrationTest extends AbstractIntegrationTest {

  @Test
  void createReadUpdateDelete() throws Exception {
    String token = signUp("owner");
    String id = createProject(token, "My App", null);

    mvc.perform(get("/api/v1/projects/" + id).header("Authorization", bearer(token)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.slug").value("my-app"))
        .andExpect(jsonPath("$.liveUrl").value("http://my-app.localhost"))
        .andExpect(jsonPath("$.buildType").value("AUTO"));

    mvc.perform(
            patch("/api/v1/projects/" + id)
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"port\":3000,\"healthCheckPath\":\"/health\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.port").value(3000))
        .andExpect(jsonPath("$.name").value("My App"));

    mvc.perform(get("/api/v1/projects").header("Authorization", bearer(token)))
        .andExpect(jsonPath("$.totalElements").value(1));

    mvc.perform(delete("/api/v1/projects/" + id).header("Authorization", bearer(token)))
        .andExpect(status().isNoContent());
    mvc.perform(get("/api/v1/projects/" + id).header("Authorization", bearer(token)))
        .andExpect(status().isNotFound());
  }

  @Test
  void otherUsersSeeNotFoundNotForbidden() throws Exception {
    String alice = signUp("alice");
    String mallory = signUp("mallory");
    String id = createProject(alice, "Secret App", null);

    mvc.perform(get("/api/v1/projects/" + id).header("Authorization", bearer(mallory)))
        .andExpect(status().isNotFound());
    mvc.perform(delete("/api/v1/projects/" + id).header("Authorization", bearer(mallory)))
        .andExpect(status().isNotFound());
    mvc.perform(get("/api/v1/projects").header("Authorization", bearer(mallory)))
        .andExpect(jsonPath("$.totalElements").value(0));
  }

  @Test
  void slugCollisions() throws Exception {
    String token = signUp("dev");
    createProject(token, "Shop", null);
    // generated slugs get a random suffix instead of failing
    String second = createProject(token, "Shop", null);
    String body =
        mvc.perform(get("/api/v1/projects/" + second).header("Authorization", bearer(token)))
            .andReturn()
            .getResponse()
            .getContentAsString();
    assertThat(read(body).get("slug").asText()).startsWith("shop-").hasSize(9);

    // an explicitly requested slug that is taken is a conflict
    mvc.perform(
            post("/api/v1/projects")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"name\":\"Other\",\"slug\":\"shop\",\"repoOwner\":\"o\",\"repoName\":\"r\"}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("SLUG_TAKEN"));
  }

  @Test
  void invalidDomainValuesAreRejectedWith400() throws Exception {
    String token = signUp("dev");
    mvc.perform(
            post("/api/v1/projects")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"name\":\"X\",\"repoOwner\":\"o\",\"repoName\":\"r\",\"rootDir\":\"../etc\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
  }

  @Test
  void envVarsAreEncryptedAndMasked() throws Exception {
    String token = signUp("dev");
    String id = createProject(token, "Env App", null);

    mvc.perform(
            put("/api/v1/projects/" + id + "/env")
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"vars\":{\"DATABASE_URL\":\"postgres://u:p@db/app\",\"MODE\":\"x\"}}"))
        .andExpect(status().isNoContent())
        .andExpect(header().string("X-Forge-Redeploy-Required", "true"));

    mvc.perform(get("/api/v1/projects/" + id + "/env").header("Authorization", bearer(token)))
        .andExpect(jsonPath("$[0].key").value("DATABASE_URL"))
        .andExpect(jsonPath("$[0].valuePreview").value("po••••••"))
        .andExpect(jsonPath("$[1].valuePreview").value("••••••"));

    byte[] stored =
        jdbc.queryForObject(
            "select value_enc from environment_variables where key = 'DATABASE_URL'", byte[].class);
    assertThat(new String(stored)).doesNotContain("postgres://");
  }

  private String createProject(String token, String name, String slug) throws Exception {
    String body =
        mvc.perform(
                post("/api/v1/projects")
                    .header("Authorization", bearer(token))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {"name":"%s",%s"repoOwner":"demo","repoName":"hello"}
                        """
                            .formatted(name, slug == null ? "" : "\"slug\":\"" + slug + "\",")))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return read(body).get("id").asText();
  }
}
