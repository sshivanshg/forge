package com.forge.agent.application;

import com.forge.agent.domain.Diagnosis;
import com.forge.agent.domain.DiagnosisRule;
import com.forge.agent.domain.DiagnosisRules;
import com.forge.agent.domain.FailureContext;
import java.util.List;
import java.util.Optional;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Deterministic, offline diagnosis from known failure patterns. Always answers (its last rule is a
 * generic fallback), so the agent works even without network or an API key.
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
class RuleBasedDiagnosisEngine implements DiagnosisEngine {

  private final List<DiagnosisRule> rules = DiagnosisRules.defaults();

  @Override
  public String name() {
    return "rules";
  }

  @Override
  public Optional<Diagnosis> diagnose(FailureContext context) {
    return rules.stream().map(rule -> rule.evaluate(context)).flatMap(Optional::stream).findFirst();
  }
}
