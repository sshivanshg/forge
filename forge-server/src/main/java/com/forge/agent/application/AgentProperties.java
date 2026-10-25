package com.forge.agent.application;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * @param anthropicApiKey enables the LLM engine when set; never logged
 * @param model Claude model id
 * @param apiBaseUrl Anthropic API base URL
 * @param logLines how many recent log lines the agent reads
 */
@ConfigurationProperties("forge.agent")
public record AgentProperties(
    String anthropicApiKey,
    @DefaultValue("claude-sonnet-5-5") String model,
    @DefaultValue("https://api.anthropic.com") String apiBaseUrl,
    @DefaultValue("150") int logLines) {

  public boolean llmEnabled() {
    return anthropicApiKey != null && !anthropicApiKey.isBlank();
  }
}
