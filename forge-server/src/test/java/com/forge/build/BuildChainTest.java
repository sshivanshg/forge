package com.forge.build;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.forge.build.detect.BuildTypeDetector;
import com.forge.build.detect.DetectorChain;
import com.forge.build.strategy.BuildStrategy;
import com.forge.build.strategy.BuildStrategyFactory;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;

/** Detector chain + strategies wired exactly as Spring wires them in production. */
class BuildChainTest {

  @Configuration
  @ComponentScan(basePackages = {"com.forge.build.detect", "com.forge.build.strategy"})
  static class BuildBeans {}

  private final ApplicationContextRunner context =
      new ApplicationContextRunner().withUserConfiguration(BuildBeans.class);

  @TempDir Path repo;

  @Test
  void userDockerfileWinsOverEverythingElse() throws IOException {
    Files.writeString(repo.resolve("Dockerfile"), "FROM scratch");
    Files.writeString(repo.resolve("pom.xml"), "<project/>");
    Files.writeString(repo.resolve("package.json"), "{}");

    context.run(
        ctx ->
            assertThat(ctx.getBean(DetectorChain.class).detect(repo))
                .isEqualTo(BuildType.DOCKERFILE));
  }

  @Test
  void detectsEachSupportedStack() throws IOException {
    Path maven = Files.createDirectory(repo.resolve("maven"));
    Files.writeString(maven.resolve("pom.xml"), "<project/>");
    Path gradle = Files.createDirectory(repo.resolve("gradle"));
    Files.writeString(gradle.resolve("build.gradle.kts"), "");
    Path node = Files.createDirectory(repo.resolve("node"));
    Files.writeString(node.resolve("package.json"), "{}");

    context.run(
        ctx -> {
          DetectorChain chain = ctx.getBean(DetectorChain.class);
          assertThat(chain.detect(maven)).isEqualTo(BuildType.MAVEN);
          assertThat(chain.detect(gradle)).isEqualTo(BuildType.GRADLE);
          assertThat(chain.detect(node)).isEqualTo(BuildType.NODE);
        });
  }

  @Test
  void unknownProjectFailsWithAHelpfulReason() {
    context.run(
        ctx ->
            assertThatThrownBy(() -> ctx.getBean(DetectorChain.class).detect(repo))
                .isInstanceOfSatisfying(
                    BuildFailedException.class,
                    e ->
                        assertThat(e.reason())
                            .isEqualTo(BuildFailedException.Reason.UNSUPPORTED_PROJECT)));
  }

  @Test
  void chainHasOneDetectorPerConcreteType() {
    context.run(ctx -> assertThat(ctx.getBeansOfType(BuildTypeDetector.class)).hasSize(4));
  }

  @Test
  void templateStrategyWritesDockerfileWithThePort() throws IOException {
    Files.writeString(repo.resolve("package.json"), "{}");
    context.run(
        ctx -> {
          BuildStrategy node = ctx.getBean(BuildStrategyFactory.class).forType(BuildType.NODE);
          Path dockerfile = node.prepare(repo, 3000);
          String content = Files.readString(dockerfile);
          assertThat(content)
              .contains("FROM node:22-alpine")
              .contains("PORT=3000")
              .contains("EXPOSE 3000");
          assertThat(content).doesNotContain("{{PORT}}");
        });
  }

  @Test
  void everyConcreteBuildTypeHasAStrategy() {
    context.run(
        ctx -> {
          BuildStrategyFactory factory = ctx.getBean(BuildStrategyFactory.class);
          for (BuildType type :
              List.of(BuildType.DOCKERFILE, BuildType.MAVEN, BuildType.GRADLE, BuildType.NODE)) {
            assertThat(factory.forType(type).type()).isEqualTo(type);
          }
        });
  }

  @Test
  void dockerfileStrategyRequiresADockerfile() {
    context.run(
        ctx ->
            assertThatThrownBy(
                    () ->
                        ctx.getBean(BuildStrategyFactory.class)
                            .forType(BuildType.DOCKERFILE)
                            .prepare(repo, 8080))
                .isInstanceOf(BuildFailedException.class));
  }
}
