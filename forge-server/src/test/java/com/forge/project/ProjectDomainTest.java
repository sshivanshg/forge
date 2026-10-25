package com.forge.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.forge.build.BuildType;
import com.forge.project.domain.BuildSettings;
import com.forge.project.domain.EnvironmentVariable;
import com.forge.project.domain.Project;
import com.forge.project.domain.RepoRef;
import com.forge.project.domain.Slug;
import com.forge.shared.error.ValidationException;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

class ProjectDomainTest {

  private static final Instant NOW = Instant.parse("2026-10-26T10:00:00Z");

  @ParameterizedTest
  @CsvSource({
    "My Cool API!, my-cool-api",
    "  hello   world , hello-world",
    "Café Déjà Vu, cafe-deja-vu",
    "!!!, app"
  })
  void derivesDnsSafeSlugFromName(String name, String expected) {
    assertThat(Slug.fromName(name).value()).isEqualTo(expected);
  }

  @ParameterizedTest
  @ValueSource(strings = {"-leading", "trailing-", "UPPER", "has space", "under_score", ""})
  void rejectsSlugsThatAreNotDnsLabels(String slug) {
    assertThatThrownBy(() -> new Slug(slug)).isInstanceOf(ValidationException.class);
  }

  @Test
  void generatedSlugIsCappedAt40Characters() {
    assertThat(Slug.fromName("a".repeat(100)).value()).hasSize(40);
  }

  @ParameterizedTest
  @ValueSource(strings = {"../etc", "/abs", "a/../b", "a\\b"})
  void rootDirMustStayInsideTheRepository(String rootDir) {
    assertThatThrownBy(() -> new BuildSettings("main", rootDir, BuildType.AUTO, 8080, "/", true))
        .isInstanceOf(ValidationException.class);
  }

  @Test
  void buildSettingsValidatePortAndHealthPath() {
    assertThatThrownBy(() -> new BuildSettings("main", ".", BuildType.AUTO, 0, "/", true))
        .isInstanceOf(ValidationException.class);
    assertThatThrownBy(() -> new BuildSettings("main", ".", BuildType.AUTO, 8080, "health", true))
        .isInstanceOf(ValidationException.class);
    assertThat(new BuildSettings("main", null, null, 3000, "/health", false))
        .satisfies(
            s -> {
              assertThat(s.rootDir()).isEqualTo(".");
              assertThat(s.buildType()).isEqualTo(BuildType.AUTO);
            });
  }

  @Test
  void repoRefRejectsPathTricks() {
    assertThatThrownBy(() -> new RepoRef("owner", "..")).isInstanceOf(ValidationException.class);
    assertThatThrownBy(() -> new RepoRef("own/er", "repo")).isInstanceOf(ValidationException.class);
    assertThat(new RepoRef("sshivanshg", "hello-spring").fullName())
        .isEqualTo("sshivanshg/hello-spring");
  }

  @Test
  void projectExposesAnImmutableSnapshotAndTracksOwnership() {
    UUID owner = UUID.randomUUID();
    Project project =
        new Project(
            owner,
            "Hello",
            new Slug("hello"),
            new RepoRef("o", "r"),
            BuildSettings.defaults(),
            NOW);
    UUID deployment = UUID.randomUUID();
    project.markLive(deployment, NOW);

    assertThat(project.isOwnedBy(owner)).isTrue();
    assertThat(project.isOwnedBy(UUID.randomUUID())).isFalse();
    assertThat(project.snapshot().liveDeploymentId()).isEqualTo(deployment);
    assertThatThrownBy(() -> project.rename(" ", NOW)).isInstanceOf(ValidationException.class);
  }

  @ParameterizedTest
  @ValueSource(strings = {"1ABC", "WITH-DASH", "", "has space"})
  void envVarKeysMustBeShellSafe(String key) {
    assertThatThrownBy(() -> EnvironmentVariable.validateKey(key))
        .isInstanceOf(ValidationException.class);
  }
}
