package com.forge.build.infrastructure;

import com.forge.build.application.BuildProperties;
import com.forge.build.application.ImageBuilder;
import com.forge.build.application.RetryingImageBuilder;
import com.forge.shared.container.ContainerCli;
import com.github.dockerjava.api.DockerClient;
import java.time.Duration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Wires the image builder for the configured engine ({@code forge.engine}), decorated with push
 * retries. The build pipeline only sees {@link ImageBuilder}, so switching engines changes no other
 * code.
 */
@Configuration
class ImageBuilderConfig {

  @Bean
  @ConditionalOnProperty(name = "forge.engine", havingValue = "apple", matchIfMissing = true)
  ImageBuilder appleImageBuilder(ContainerCli cli, BuildProperties properties) {
    return retrying(new AppleContainerImageBuilder(cli, properties.builderMemoryMb()));
  }

  @Bean
  @ConditionalOnProperty(name = "forge.engine", havingValue = "docker")
  ImageBuilder dockerImageBuilder(DockerClient docker) {
    return retrying(new DockerImageBuilder(docker));
  }

  private static ImageBuilder retrying(ImageBuilder builder) {
    return new RetryingImageBuilder(builder, 3, Duration.ofSeconds(2));
  }
}
