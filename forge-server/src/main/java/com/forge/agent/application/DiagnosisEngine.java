package com.forge.agent.application;

import com.forge.agent.domain.Diagnosis;
import com.forge.agent.domain.FailureContext;
import java.util.Optional;

/**
 * Strategy for reasoning about a failure. Engines are tried in {@code @Order}: the LLM engine first
 * (when configured), the rule engine last, which always produces an answer.
 */
public interface DiagnosisEngine {

  /** Recorded with the insight, e.g. "rules" or the model id. */
  String name();

  /** Empty means "I cannot decide", and the next engine is asked. */
  Optional<Diagnosis> diagnose(FailureContext context);
}
