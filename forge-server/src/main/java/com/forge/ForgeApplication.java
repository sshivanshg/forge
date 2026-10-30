package com.forge;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Forge control plane.
 *
 * <p>A modular monolith: every top-level package below {@code com.forge} is an application module
 * whose boundaries are verified by {@code ModularityTest}.
 */
@SpringBootApplication
@ConfigurationPropertiesScan
@EnableScheduling
@EnableAsync
public class ForgeApplication {

  public static void main(String[] args) {
    SpringApplication.run(ForgeApplication.class, args);
  }
}
