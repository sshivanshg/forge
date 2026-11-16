package com.forge.agent.domain;

import com.forge.build.BuildType;

/** Settings the agent wants to change; {@code null} fields stay as they are. */
public record SettingsPatch(
    String rootDir, BuildType buildType, Integer port, String healthCheckPath, Integer replicas) {

  public static SettingsPatch port(int port) {
    return new SettingsPatch(null, null, port, null, null);
  }

  public static SettingsPatch healthCheckPath(String path) {
    return new SettingsPatch(null, null, null, path, null);
  }

  public static SettingsPatch replicas(int replicas) {
    return new SettingsPatch(null, null, null, null, replicas);
  }

  @com.fasterxml.jackson.annotation.JsonIgnore
  public boolean isEmpty() {
    return rootDir == null
        && buildType == null
        && port == null
        && healthCheckPath == null
        && replicas == null;
  }
}
