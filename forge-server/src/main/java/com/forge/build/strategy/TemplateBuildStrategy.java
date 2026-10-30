package com.forge.build.strategy;

import com.forge.build.BuildType;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Base class for strategies that generate a Dockerfile from a template in {@code
 * resources/build-templates}. Subclasses only name their type and template (inheritance removes the
 * duplication between Maven, Gradle and Node).
 */
abstract class TemplateBuildStrategy implements BuildStrategy {

  static final String GENERATED_DOCKERFILE = "Dockerfile.forge";

  private final BuildType type;
  private final String template;

  protected TemplateBuildStrategy(BuildType type, String templateName) {
    this.type = type;
    this.template = load(templateName);
  }

  @Override
  public final BuildType type() {
    return type;
  }

  @Override
  public final Path prepare(Path contextDir, int port) {
    Path dockerfile = contextDir.resolve(GENERATED_DOCKERFILE);
    try {
      Files.writeString(dockerfile, render(port));
      return dockerfile;
    } catch (IOException e) {
      throw new UncheckedIOException("Could not write generated Dockerfile", e);
    }
  }

  String render(int port) {
    return template.replace("{{PORT}}", Integer.toString(port));
  }

  private static String load(String name) {
    String path = "/build-templates/" + name;
    try (InputStream in = TemplateBuildStrategy.class.getResourceAsStream(path)) {
      if (in == null) {
        throw new IllegalStateException("Missing build template " + path);
      }
      return new String(in.readAllBytes(), StandardCharsets.UTF_8);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }
}
