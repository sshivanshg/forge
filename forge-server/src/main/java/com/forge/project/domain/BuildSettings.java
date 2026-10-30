package com.forge.project.domain;

import com.forge.build.BuildType;
import com.forge.shared.error.ValidationException;

/**
 * Value object: everything Forge needs to know to build and run the app. Validated on construction,
 * so invalid settings cannot reach the build pipeline.
 */
public record BuildSettings(
    String branch,
    String rootDir,
    BuildType buildType,
    int port,
    String healthCheckPath,
    boolean autoDeploy) {

  public BuildSettings {
    if (branch == null || branch.isBlank() || branch.length() > 255 || branch.contains("..")) {
      throw new ValidationException("branch is invalid");
    }
    rootDir = rootDir == null || rootDir.isBlank() ? "." : rootDir.strip();
    if (rootDir.startsWith("/") || rootDir.contains("..") || rootDir.contains("\\")) {
      throw new ValidationException("rootDir must be a relative path inside the repository");
    }
    if (buildType == null) {
      buildType = BuildType.AUTO;
    }
    if (port < 1 || port > 65535) {
      throw new ValidationException("port must be between 1 and 65535");
    }
    if (healthCheckPath == null || !healthCheckPath.startsWith("/")) {
      throw new ValidationException("healthCheckPath must start with /");
    }
  }

  public static BuildSettings defaults() {
    return new BuildSettings("main", ".", BuildType.AUTO, 8080, "/", true);
  }
}
