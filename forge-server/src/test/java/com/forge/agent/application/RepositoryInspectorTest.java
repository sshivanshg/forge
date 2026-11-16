package com.forge.agent.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.forge.build.BuildType;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class RepositoryInspectorTest {

  @TempDir Path repo;

  @Test
  void findsANodeAppInASubfolderAndItsPort() throws IOException {
    Files.createDirectories(repo.resolve("backend"));
    Files.writeString(repo.resolve("README.md"), "# hi");
    Files.writeString(repo.resolve("backend/package.json"), "{}");
    Files.writeString(repo.resolve("backend/server.js"), "app.listen(process.env.PORT || 4000);");

    var found = RepositoryInspector.inspect(repo).orElseThrow();

    assertThat(found.dir().toString()).isEqualTo("backend");
    assertThat(found.type()).isEqualTo(BuildType.NODE);
    assertThat(found.port()).contains(4000);
  }

  @Test
  void prefersTheShallowestFolderAndADockerfileOverOtherMarkers() throws IOException {
    Files.createDirectories(repo.resolve("api/nested"));
    Files.writeString(repo.resolve("api/pom.xml"), "<project/>");
    Files.writeString(repo.resolve("api/Dockerfile"), "FROM x\nEXPOSE 9090\n");
    Files.writeString(repo.resolve("api/nested/package.json"), "{}");

    var found = RepositoryInspector.inspect(repo).orElseThrow();

    assertThat(found.dir().toString()).isEqualTo("api");
    assertThat(found.type()).isEqualTo(BuildType.DOCKERFILE);
    assertThat(found.port()).contains(9090);
  }

  @Test
  void ignoresDependencyFolders() throws IOException {
    Files.createDirectories(repo.resolve("node_modules/lib"));
    Files.writeString(repo.resolve("node_modules/lib/package.json"), "{}");

    assertThat(RepositoryInspector.inspect(repo)).isEmpty();
  }

  @Test
  void springAppsDefaultToPort8080() {
    assertThat(RepositoryInspector.guessPort(repo, BuildType.MAVEN)).contains(8080);
  }
}
