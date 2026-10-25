package com.forge.build;

/** How a repository is turned into a container image. AUTO lets the detector chain decide. */
public enum BuildType {
  AUTO,
  DOCKERFILE,
  MAVEN,
  GRADLE,
  NODE
}
