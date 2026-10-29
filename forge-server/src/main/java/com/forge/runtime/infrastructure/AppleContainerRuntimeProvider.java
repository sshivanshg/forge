package com.forge.runtime.infrastructure;

import com.forge.runtime.ContainerSpec;
import com.forge.runtime.RunningInstance;
import com.forge.runtime.RuntimeProvider;
import com.forge.runtime.application.RoutingTable;
import com.forge.shared.container.ContainerCli;
import com.forge.shared.error.ExternalServiceException;
import java.io.Closeable;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Consumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Adapter: runs user apps with Apple's {@code container} tool (active when {@code
 * forge.engine=apple}, the default). Every app gets its own lightweight Linux VM, which isolates
 * apps from each other more strongly than shared-kernel containers do.
 *
 * <p>Isolation: memory and CPU limits, all Linux capabilities dropped, and an init process that
 * forwards SIGTERM so the app can drain during a blue-green swap. The control plane reaches each VM
 * directly on its own IP, both for health checks and for routing ({@link AppleRoutingTable}).
 */
class AppleContainerRuntimeProvider implements RuntimeProvider {

  private static final Logger log = LoggerFactory.getLogger(AppleContainerRuntimeProvider.class);
  private static final Duration COMMAND_TIMEOUT = Duration.ofMinutes(2);
  private static final Duration IP_WAIT = Duration.ofSeconds(15);

  private final ContainerCli cli;
  private final AppleContainers containers;
  private final RoutingTable routing;
  private final RuntimeProperties properties;

  AppleContainerRuntimeProvider(
      ContainerCli cli,
      AppleContainers containers,
      RoutingTable routing,
      RuntimeProperties properties) {
    this.cli = cli;
    this.containers = containers;
    this.routing = routing;
    this.properties = properties;
  }

  @Override
  public RunningInstance start(ContainerSpec spec) {
    cli.run(COMMAND_TIMEOUT, "delete", "--force", spec.name()); // a retried job's leftover
    Path envFile = writeEnvFile(spec.environment());
    try {
      List<String> args = new ArrayList<>();
      args.addAll(
          List.of(
              "run",
              "--detach",
              "--name",
              spec.name(),
              "--memory",
              properties.memoryMb() + "M",
              "--cpus",
              Integer.toString((int) Math.max(1, Math.round(properties.cpus()))),
              "--init",
              "--cap-drop",
              "ALL",
              "--env-file",
              envFile.toString()));
      labels(spec).forEach((k, v) -> args.addAll(List.of("--label", k + "=" + v)));
      args.add(spec.image());
      ContainerCli.Result result = cli.run(COMMAND_TIMEOUT, args.toArray(String[]::new));
      if (!result.ok()) {
        throw new ExternalServiceException("Could not start container: " + result.text(), null);
      }
    } finally {
      deleteQuietly(envFile);
    }
    String ip = waitForIp(spec.name());
    log.info("Started {} for {} at {}", spec.name(), spec.image(), ip);
    routing.refresh();
    return new RunningInstance(spec.name(), URI.create("http://" + ip + ":" + spec.port()));
  }

  /** Apple container has no restart policy; a crashed instance is replaced by a redeploy. */
  @Override
  public void promote(String instanceId) {
    // nothing to change
  }

  @Override
  public void stop(String instanceId) {
    cli.run(COMMAND_TIMEOUT, "stop", "--time", "10", instanceId);
    ContainerCli.Result removed = cli.run(COMMAND_TIMEOUT, "delete", "--force", instanceId);
    if (!removed.ok() && containers.inspect(instanceId).isPresent()) {
      log.warn("Removing {} failed: {}", instanceId, removed.text());
    }
    routing.refresh();
  }

  @Override
  public boolean isRunning(String instanceId) {
    return containers.inspect(instanceId).map(AppleContainers.Info::running).orElse(false);
  }

  /** Apple container does not report exit codes, so the logs carry the reason. */
  @Override
  public String exitDescription(String instanceId) {
    Optional<AppleContainers.Info> info = containers.inspect(instanceId);
    if (info.isEmpty()) {
      return "container no longer exists";
    }
    return info.get().running() ? "running" : "process exited (see the app's last log lines)";
  }

  @Override
  public List<String> recentOutput(String instanceId, int lines) {
    ContainerCli.Result result =
        cli.run(Duration.ofSeconds(10), "logs", "-n", Integer.toString(lines), instanceId);
    return result.ok() ? result.output() : List.of();
  }

  @Override
  public Closeable followOutput(String instanceId, int tail, Consumer<String> lineConsumer) {
    return cli.follow(lineConsumer, "logs", "--follow", "-n", Integer.toString(tail), instanceId);
  }

  static Map<String, String> labels(ContainerSpec spec) {
    return Map.of(
        AppleRoutingTable.MANAGED,
        "true",
        "forge.project",
        String.valueOf(spec.projectSlug()),
        "forge.deployment",
        spec.deploymentId().toString(),
        AppleRoutingTable.ROUTE,
        spec.routeName(),
        AppleRoutingTable.HOST,
        spec.routeHost(),
        AppleRoutingTable.PORT,
        Integer.toString(spec.port()),
        AppleRoutingTable.HEALTH_PATH,
        spec.healthPath());
  }

  private String waitForIp(String name) {
    long deadline = System.nanoTime() + IP_WAIT.toNanos();
    while (System.nanoTime() < deadline) {
      Optional<AppleContainers.Info> info = containers.inspect(name);
      if (info.isPresent() && info.get().ipv4() != null) {
        return info.get().ipv4();
      }
      if (info.isPresent() && !info.get().running()) {
        break; // exited before it got going; the health probe reports why
      }
      sleep();
    }
    throw new ExternalServiceException("Container " + name + " has no IP address", null);
  }

  /**
   * Environment values go through a private temp file, never the command line, where any local user
   * could read them with {@code ps}.
   */
  private static Path writeEnvFile(Map<String, String> environment) {
    try {
      Path file =
          Files.createTempFile(
              "forge-env-",
              ".env",
              PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")));
      StringBuilder content = new StringBuilder();
      environment.forEach(
          (k, v) -> content.append(k).append('=').append(v.replace("\n", "\\n")).append('\n'));
      Files.writeString(file, content, StandardCharsets.UTF_8);
      return file;
    } catch (IOException e) {
      throw new ExternalServiceException("Could not prepare environment: " + e.getMessage(), e);
    }
  }

  private static void deleteQuietly(Path file) {
    try {
      Files.deleteIfExists(file);
    } catch (IOException ignored) {
      // temp directory is cleaned by the OS
    }
  }

  private static void sleep() {
    try {
      Thread.sleep(500);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new ExternalServiceException("Interrupted while starting container", e);
    }
  }
}
