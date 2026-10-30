package com.forge.build.strategy;

import com.forge.build.BuildType;
import org.springframework.stereotype.Component;

/** Concrete template strategies, one per supported stack. */
final class TemplateStrategies {

  private TemplateStrategies() {}

  /** Spring Boot / any Maven project: build with Maven, run the fat jar on a JRE 21 image. */
  @Component
  static class MavenBuildStrategy extends TemplateBuildStrategy {
    MavenBuildStrategy() {
      super(BuildType.MAVEN, "maven.Dockerfile");
    }
  }

  /** Gradle projects: same idea with the Gradle image. */
  @Component
  static class GradleBuildStrategy extends TemplateBuildStrategy {
    GradleBuildStrategy() {
      super(BuildType.GRADLE, "gradle.Dockerfile");
    }
  }

  /** Node.js: npm install, optional build script, npm start. */
  @Component
  static class NodeBuildStrategy extends TemplateBuildStrategy {
    NodeBuildStrategy() {
      super(BuildType.NODE, "node.Dockerfile");
    }
  }
}
