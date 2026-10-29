package com.forge.runtime.infrastructure;

import com.forge.runtime.ContainerSpec;
import com.forge.runtime.RunningInstance;
import com.forge.runtime.RuntimeProvider;
import com.forge.shared.error.ExternalServiceException;
import com.github.dockerjava.api.DockerClient;
import com.github.dockerjava.api.async.ResultCallback;
import com.github.dockerjava.api.command.InspectContainerResponse;
import com.github.dockerjava.api.exception.DockerException;
import com.github.dockerjava.api.exception.NotFoundException;
import com.github.dockerjava.api.exception.NotModifiedException;
import com.github.dockerjava.api.model.ExposedPort;
import com.github.dockerjava.api.model.Frame;
import com.github.dockerjava.api.model.HostConfig;
import com.github.dockerjava.api.model.Network;
import com.github.dockerjava.api.model.PortBinding;
import com.github.dockerjava.api.model.Ports;
import com.github.dockerjava.api.model.RestartPolicy;
import java.io.Closeable;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Adapter: runs user apps as Docker containers (active when {@code forge.engine=docker}).
 *
 * <p>Isolation: memory and CPU limits, a process limit, {@code no-new-privileges}, and a dedicated
 * network that contains only apps and the reverse proxy (not our database). The app's port is also
 * published on 127.0.0.1 so the control plane can health-check this exact container before any
 * traffic reaches it.
 */
@Component
@ConditionalOnProperty(name = "forge.engine", havingValue = "docker")
class DockerRuntimeProvider implements RuntimeProvider {

  private static final Logger log = LoggerFactory.getLogger(DockerRuntimeProvider.class);

  private final DockerClient docker;
  private final RuntimeProperties properties;

  DockerRuntimeProvider(DockerClient docker, RuntimeProperties properties) {
    this.docker = docker;
    this.properties = properties;
  }

  @Override
  public RunningInstance start(ContainerSpec spec) {
    try {
      ensureNetwork();
      removeIfExists(spec.name()); // a retried job may find its own half-started container
      ExposedPort appPort = ExposedPort.tcp(spec.port());
      HostConfig host =
          HostConfig.newHostConfig()
              .withNetworkMode(properties.network())
              .withMemory(properties.memoryMb() * 1024L * 1024L)
              .withNanoCPUs((long) (properties.cpus() * 1_000_000_000L))
              .withPidsLimit(256L)
              // A tiny init (tini) as PID 1 forwards SIGTERM to the app, so it can shut down
              // gracefully during a blue-green swap instead of being SIGKILLed mid-request.
              .withInit(true)
              .withSecurityOpts(List.of("no-new-privileges"))
              .withRestartPolicy(RestartPolicy.noRestart())
              .withPortBindings(
                  new PortBinding(Ports.Binding.bindIp(properties.probeHost()), appPort));
      String id =
          docker
              .createContainerCmd(spec.image())
              .withName(spec.name())
              .withEnv(
                  spec.environment().entrySet().stream()
                      .map(e -> e.getKey() + "=" + e.getValue())
                      .toList())
              .withLabels(TraefikLabels.forSpec(spec, properties.network()))
              .withExposedPorts(appPort)
              .withHostConfig(host)
              .exec()
              .getId();
      docker.startContainerCmd(id).exec();
      String hostPort = publishedPort(id, appPort);
      log.info("Started container {} for {} on host port {}", shortId(id), spec.image(), hostPort);
      return new RunningInstance(
          id, URI.create("http://" + properties.probeHost() + ":" + hostPort));
    } catch (DockerException e) {
      throw new ExternalServiceException("Could not start container: " + e.getMessage(), e);
    }
  }

  @Override
  public void promote(String instanceId) {
    try {
      docker
          .updateContainerCmd(instanceId)
          .withRestartPolicy(RestartPolicy.unlessStoppedRestart())
          .exec();
    } catch (DockerException e) {
      log.warn("Could not set restart policy on {}: {}", shortId(instanceId), e.getMessage());
    }
  }

  @Override
  public void stop(String instanceId) {
    try {
      docker.stopContainerCmd(instanceId).withTimeout(10).exec();
    } catch (NotModifiedException | NotFoundException alreadyStopped) {
      // idempotent
    } catch (DockerException e) {
      log.warn("Stopping {} failed: {}", shortId(instanceId), e.getMessage());
    }
    try {
      docker.removeContainerCmd(instanceId).withForce(true).exec();
    } catch (NotFoundException alreadyGone) {
      // idempotent
    } catch (DockerException e) {
      log.warn("Removing {} failed: {}", shortId(instanceId), e.getMessage());
    }
  }

  @Override
  public boolean isRunning(String instanceId) {
    try {
      return Boolean.TRUE.equals(
          docker.inspectContainerCmd(instanceId).exec().getState().getRunning());
    } catch (NotFoundException e) {
      return false;
    }
  }

  @Override
  public String exitDescription(String instanceId) {
    try {
      InspectContainerResponse.ContainerState state =
          docker.inspectContainerCmd(instanceId).exec().getState();
      if (Boolean.TRUE.equals(state.getRunning())) {
        return "running";
      }
      String oom = Boolean.TRUE.equals(state.getOOMKilled()) ? " (killed: out of memory)" : "";
      return "exited with code " + state.getExitCodeLong() + oom;
    } catch (NotFoundException e) {
      return "container no longer exists";
    }
  }

  @Override
  public List<String> recentOutput(String instanceId, int lines) {
    List<String> output = new CopyOnWriteArrayList<>();
    try {
      docker
          .logContainerCmd(instanceId)
          .withStdOut(true)
          .withStdErr(true)
          .withTail(lines)
          .exec(frameCallback(output::add))
          .awaitCompletion(5, TimeUnit.SECONDS);
    } catch (NotFoundException e) {
      return List.of();
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
    return List.copyOf(output);
  }

  @Override
  public Closeable followOutput(String instanceId, int tail, Consumer<String> lineConsumer) {
    return docker
        .logContainerCmd(instanceId)
        .withStdOut(true)
        .withStdErr(true)
        .withFollowStream(true)
        .withTail(tail)
        .exec(frameCallback(lineConsumer));
  }

  private static ResultCallback.Adapter<Frame> frameCallback(Consumer<String> lines) {
    return new ResultCallback.Adapter<>() {
      @Override
      public void onNext(Frame frame) {
        for (String line :
            new String(frame.getPayload(), StandardCharsets.UTF_8).split("\\r?\\n")) {
          if (!line.isBlank()) {
            lines.accept(line);
          }
        }
      }
    };
  }

  private String publishedPort(String containerId, ExposedPort port) {
    Ports.Binding[] bindings =
        docker
            .inspectContainerCmd(containerId)
            .exec()
            .getNetworkSettings()
            .getPorts()
            .getBindings()
            .get(port);
    if (bindings == null || bindings.length == 0) {
      throw new ExternalServiceException("Container port " + port + " was not published", null);
    }
    return bindings[0].getHostPortSpec();
  }

  private void ensureNetwork() {
    List<Network> existing = docker.listNetworksCmd().withNameFilter(properties.network()).exec();
    boolean present = existing.stream().anyMatch(n -> properties.network().equals(n.getName()));
    if (!present) {
      docker.createNetworkCmd().withName(properties.network()).withDriver("bridge").exec();
    }
  }

  private void removeIfExists(String name) {
    try {
      docker.removeContainerCmd(name).withForce(true).exec();
    } catch (NotFoundException ignored) {
      // nothing to clean up
    }
  }

  private static String shortId(String id) {
    return id.length() > 12 ? id.substring(0, 12) : id;
  }
}
