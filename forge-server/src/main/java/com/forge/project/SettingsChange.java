package com.forge.project;

import com.forge.build.BuildType;

/**
 * A partial change to a project's build and run settings, as proposed by the agent and approved by
 * the owner. {@code null} means "leave unchanged".
 */
public record SettingsChange(
    String rootDir, BuildType buildType, Integer port, String healthCheckPath, Integer replicas) {

  public boolean isEmpty() {
    return rootDir == null
        && buildType == null
        && port == null
        && healthCheckPath == null
        && replicas == null;
  }
}
