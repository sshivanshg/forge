package com.forge.agent.domain;

import java.util.Optional;

/** One piece of expert knowledge: recognises a single kind of failure. */
public interface DiagnosisRule {

  Optional<Diagnosis> evaluate(FailureContext context);
}
