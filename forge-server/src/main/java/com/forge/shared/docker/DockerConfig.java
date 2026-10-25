package com.forge.shared.docker;

import com.github.dockerjava.api.DockerClient;
import com.github.dockerjava.core.DefaultDockerClientConfig;
import com.github.dockerjava.core.DockerClientImpl;
import com.github.dockerjava.httpclient5.ApacheDockerHttpClient;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * One shared Docker Engine API client, used by the build module (image builds and pushes) and the
 * runtime module (containers). Both only see it through their own adapters.
 */
@Configuration
public class DockerConfig {

  private static final Logger log = LoggerFactory.getLogger(DockerConfig.class);

  @Bean(destroyMethod = "close")
  DockerClient dockerClient(DockerProperties properties) {
    String host = resolveHost(properties.host());
    log.info("Using Docker engine at {}", host);
    var config =
        DefaultDockerClientConfig.createDefaultConfigBuilder().withDockerHost(host).build();
    var http =
        new ApacheDockerHttpClient.Builder()
            .dockerHost(config.getDockerHost())
            .maxConnections(50)
            .connectionTimeout(Duration.ofSeconds(10))
            .responseTimeout(Duration.ofMinutes(15))
            .build();
    return DockerClientImpl.getInstance(config, http);
  }

  /**
   * Explicit setting first, then {@code DOCKER_HOST}, then Docker Desktop's per-user socket, then
   * the classic Linux socket.
   */
  static String resolveHost(String configured) {
    if (configured != null && !configured.isBlank()) {
      return configured;
    }
    String env = System.getenv("DOCKER_HOST");
    if (env != null && !env.isBlank()) {
      return env;
    }
    Path desktopSocket = Path.of(System.getProperty("user.home"), ".docker", "run", "docker.sock");
    if (Files.exists(desktopSocket)) {
      return "unix://" + desktopSocket;
    }
    return "unix:///var/run/docker.sock";
  }
}
