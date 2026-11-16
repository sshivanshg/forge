package com.forge.agent.application;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * @param anthropicApiKey enables the LLM engine when set; never logged
 * @param model Claude model id
 * @param apiBaseUrl Anthropic API base URL
 * @param logLines how many recent log lines the agent reads
 * @param autoConfigure inspect the repository when Forge cannot detect how to build it
 * @param healthWatch watch LIVE apps' traffic and propose a rollback or scale-out
 * @param maxToolCalls upper bound on tool calls in one LLM investigation
 */
@ConfigurationProperties("forge.agent")
public record AgentProperties(
    String anthropicApiKey,
    @DefaultValue("claude-sonnet-5-5") String model,
    @DefaultValue("https://api.anthropic.com") String apiBaseUrl,
    @DefaultValue("150") int logLines,
    @DefaultValue("true") boolean autoConfigure,
    @DefaultValue("true") boolean healthWatch,
    @DefaultValue("8") int maxToolCalls) {

  public boolean llmEnabled() {
    return anthropicApiKey != null && !anthropicApiKey.isBlank();
  }
}
