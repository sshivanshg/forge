package com.forge.jobs.infrastructure;

import com.forge.jobs.Job;
import com.forge.jobs.JobHandler;
import com.forge.jobs.JobPostponedException;
import com.forge.jobs.JobType;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.annotation.PreDestroy;
import java.lang.management.ManagementFactory;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * The worker loop. Polls the queue, runs each job on its own virtual thread, keeps the lease alive
 * with heartbeats and records the outcome. A {@link Semaphore} caps how many jobs run at once
 * (back-pressure), because Docker builds are CPU- and memory-heavy.
 */
@Component
public class JobRunner {

  private static final Logger log = LoggerFactory.getLogger(JobRunner.class);

  private final PostgresJobQueue queue;
  private final JobsProperties properties;
  private final Map<JobType, JobHandler> handlers;
  private final Semaphore permits;
  private final ExecutorService workers = Executors.newVirtualThreadPerTaskExecutor();
  private final ScheduledExecutorService heartbeats =
      Executors.newSingleThreadScheduledExecutor(Thread.ofVirtual().factory());
  private final String workerId =
      "worker-" + ManagementFactory.getRuntimeMXBean().getName().replace('@', '-');
  private volatile boolean accepting = true;

  public JobRunner(
      PostgresJobQueue queue,
      JobsProperties properties,
      List<JobHandler> handlerBeans,
      MeterRegistry meters) {
    this.queue = queue;
    this.properties = properties;
    this.handlers = registry(handlerBeans);
    this.permits = new Semaphore(properties.maxConcurrent());
    Gauge.builder("forge.jobs.pending", () -> queue.countByStatus("PENDING"))
        .description("Jobs waiting to be claimed")
        .register(meters);
  }

  /** Registry/factory: one handler per job type, validated at startup. */
  private static Map<JobType, JobHandler> registry(List<JobHandler> beans) {
    Map<JobType, JobHandler> map = new EnumMap<>(JobType.class);
    for (JobHandler handler : beans) {
      if (map.put(handler.type(), handler) != null) {
        throw new IllegalStateException("Two handlers registered for " + handler.type());
      }
    }
    return map;
  }

  @Scheduled(fixedDelayString = "${forge.jobs.poll-interval:2s}")
  public void poll() {
    if (!properties.enabled()) {
      return;
    }
    while (accepting && permits.tryAcquire()) {
      Optional<Job> job;
      try {
        job = queue.claim(workerId, properties.lease());
      } catch (RuntimeException e) {
        permits.release();
        log.warn("Could not poll the job queue: {}", e.getMessage());
        return;
      }
      if (job.isEmpty()) {
        permits.release();
        return;
      }
      workers.submit(
          () -> {
            try {
              run(job.get());
            } finally {
              permits.release();
            }
          });
    }
  }

  /** Runs one job synchronously. Public so tests can drive the pipeline deterministically. */
  public void run(Job job) {
    JobHandler handler = handlers.get(job.type());
    long beatEvery = Math.max(1, properties.lease().toSeconds() / 3);
    ScheduledFuture<?> heartbeat =
        heartbeats.scheduleAtFixedRate(
            () -> queue.heartbeat(job.id(), workerId, properties.lease()),
            beatEvery,
            beatEvery,
            TimeUnit.SECONDS);
    try {
      log.info(
          "Running {} job {} (attempt {}/{})",
          job.type(),
          job.id(),
          job.attempts(),
          job.maxAttempts());
      handler.handle(job);
      queue.complete(job.id());
    } catch (JobPostponedException postponed) {
      log.info("Job {} postponed: {}", job.id(), postponed.getMessage());
      queue.postpone(job.id(), postponed.delay());
    } catch (Throwable error) {
      boolean retry = handler.isRetryable(error) && job.hasAttemptsLeft();
      if (retry) {
        log.warn("Job {} failed, will retry: {}", job.id(), error.toString());
        queue.retryLater(job, error.toString());
      } else {
        log.error("Job {} failed permanently", job.id(), error);
        queue.fail(job.id(), handler.isRetryable(error), error.toString());
        safelyExhaust(handler, job, error);
      }
    } finally {
      heartbeat.cancel(false);
    }
  }

  /** Crash recovery: give abandoned jobs to another worker, or fail them for good. */
  @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
  public void reap() {
    if (!properties.enabled()) {
      return;
    }
    for (Job dead : queue.reapExpiredLeases()) {
      log.error("Job {} abandoned too many times; marking dead", dead.id());
      safelyExhaust(
          handlers.get(dead.type()), dead, new IllegalStateException("worker lease expired"));
    }
  }

  private static void safelyExhaust(JobHandler handler, Job job, Throwable error) {
    try {
      handler.onExhausted(job, error);
    } catch (RuntimeException e) {
      log.error("onExhausted hook failed for job {}", job.id(), e);
    }
  }

  @PreDestroy
  void shutdown() throws InterruptedException {
    accepting = false;
    workers.shutdown();
    heartbeats.shutdown();
    if (!workers.awaitTermination(30, TimeUnit.SECONDS)) {
      log.warn("Jobs still running at shutdown; their leases will expire and they will be retried");
    }
  }
}
