package com.forge.build.infrastructure;

import com.forge.build.application.ImageBuilder;
import com.forge.build.application.RetryingImageBuilder;
import com.github.dockerjava.api.DockerClient;
import java.time.Duration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Wires the image builder: the Docker adapter, decorated with push retries. */
@Configuration
class ImageBuilderConfig {

  @Bean
  ImageBuilder imageBuilder(DockerClient docker) {
    return new RetryingImageBuilder(new DockerImageBuilder(docker), 3, Duration.ofSeconds(2));
  }
}
