package com.forge.shared.container;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Active when {@code forge.engine=apple} (the default): user apps are built and run with Apple's
 * {@code container} tool, each in its own lightweight VM.
 */
@Configuration
@ConditionalOnProperty(name = "forge.engine", havingValue = "apple", matchIfMissing = true)
public class AppleContainerConfig {

  /**
   * @param binary path or name of the {@code container} executable
   */
  @ConfigurationProperties("forge.apple-container")
  public record Properties(@DefaultValue("container") String binary) {}

  @Bean
  ContainerCli containerCli(Properties properties) {
    return new ContainerCli(properties.binary());
  }
}
