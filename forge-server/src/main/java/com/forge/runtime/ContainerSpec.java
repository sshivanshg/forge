package com.forge.runtime;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Immutable description of what to run. Created with {@link #builder()} because it has many fields,
 * several of them optional (Builder pattern).
 */
public record ContainerSpec(
    String name,
    String image,
    int port,
    Map<String, String> environment,
    String routeHost,
    String routeName,
    String healthPath,
    UUID deploymentId,
    String projectSlug) {

  public ContainerSpec {
    Objects.requireNonNull(name, "name");
    Objects.requireNonNull(image, "image");
    Objects.requireNonNull(routeHost, "routeHost");
    Objects.requireNonNull(routeName, "routeName");
    Objects.requireNonNull(deploymentId, "deploymentId");
    environment = Map.copyOf(environment);
    healthPath = healthPath == null ? "/" : healthPath;
    if (port < 1 || port > 65535) {
      throw new IllegalArgumentException("port out of range");
    }
  }

  public static Builder builder() {
    return new Builder();
  }

  /** Fluent builder for {@link ContainerSpec}. */
  public static final class Builder {
    private String name;
    private String image;
    private int port = 8080;
    private final Map<String, String> environment = new LinkedHashMap<>();
    private String routeHost;
    private String routeName;
    private String healthPath = "/";
    private UUID deploymentId;
    private String projectSlug;

    private Builder() {}

    public Builder name(String name) {
      this.name = name;
      return this;
    }

    public Builder image(String image) {
      this.image = image;
      return this;
    }

    public Builder port(int port) {
      this.port = port;
      return this;
    }

    public Builder environment(Map<String, String> values) {
      this.environment.putAll(values);
      return this;
    }

    public Builder env(String key, String value) {
      this.environment.put(key, value);
      return this;
    }

    public Builder route(String routeName, String routeHost) {
      this.routeName = routeName;
      this.routeHost = routeHost;
      return this;
    }

    public Builder healthPath(String healthPath) {
      this.healthPath = healthPath;
      return this;
    }

    public Builder deployment(UUID deploymentId, String projectSlug) {
      this.deploymentId = deploymentId;
      this.projectSlug = projectSlug;
      return this;
    }

    public ContainerSpec build() {
      return new ContainerSpec(
          name,
          image,
          port,
          environment,
          routeHost,
          routeName,
          healthPath,
          deploymentId,
          projectSlug);
    }
  }
}
