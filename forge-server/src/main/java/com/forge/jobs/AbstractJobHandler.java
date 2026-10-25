package com.forge.jobs;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.forge.shared.error.ExternalServiceException;
import com.forge.shared.logging.MdcKeys;
import com.forge.shared.logging.MdcScope;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.dao.OptimisticLockingFailureException;

/**
 * Template Method: {@link #handle(Job)} is final and fixes the skeleton every job shares (decode
 * payload → logging context → timing metric → work), while subclasses only implement {@link
 * #doHandle}.
 *
 * @param <P> the typed payload, e.g. {@code BuildPayload}
 */
public abstract class AbstractJobHandler<P extends JobPayload> implements JobHandler {

  private final Class<P> payloadType;
  private final ObjectMapper objectMapper;
  private final MeterRegistry meters;

  protected AbstractJobHandler(
      Class<P> payloadType, ObjectMapper objectMapper, MeterRegistry meters) {
    this.payloadType = payloadType;
    this.objectMapper = objectMapper;
    this.meters = meters;
  }

  @Override
  public final void handle(Job job) {
    P payload = decode(job);
    try (var ignored =
        MdcScope.of(MdcKeys.DEPLOYMENT_ID, payload.deploymentId(), MdcKeys.JOB_ID, job.id())) {
      Timer.Sample sample = Timer.start(meters);
      String outcome = "success";
      try {
        doHandle(payload, job);
      } catch (RuntimeException e) {
        outcome = "failure";
        throw e;
      } finally {
        sample.stop(
            Timer.builder("forge.jobs.duration")
                .description("Time spent executing background jobs")
                .tag("type", type().name())
                .tag("outcome", outcome)
                .register(meters));
      }
    }
  }

  /**
   * Default policy: transient failures are retried. These are external systems (GitHub, Docker,
   * registry) and optimistic-lock conflicts, where a concurrent update won and a retry re-reads
   * fresh state.
   */
  @Override
  public boolean isRetryable(Throwable error) {
    return error instanceof ExternalServiceException
        || error instanceof OptimisticLockingFailureException;
  }

  @Override
  public final void onExhausted(Job job, Throwable error) {
    P payload = decode(job);
    try (var ignored = MdcScope.of(MdcKeys.DEPLOYMENT_ID, payload.deploymentId())) {
      onFailedPermanently(payload, error);
    }
  }

  /** The actual work. Runs outside any transaction; open short ones where state changes. */
  protected abstract void doHandle(P payload, Job job);

  /** Hook: make the business state reflect the permanent failure. */
  protected abstract void onFailedPermanently(P payload, Throwable error);

  private P decode(Job job) {
    try {
      return objectMapper.readValue(job.payload(), payloadType);
    } catch (JsonProcessingException e) {
      throw new IllegalStateException("Corrupt payload for job " + job.id(), e);
    }
  }
}
