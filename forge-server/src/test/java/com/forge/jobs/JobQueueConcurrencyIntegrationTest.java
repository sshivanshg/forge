package com.forge.jobs;

import static org.assertj.core.api.Assertions.assertThat;

import com.forge.jobs.infrastructure.PostgresJobQueue;
import com.forge.support.AbstractIntegrationTest;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.support.TransactionTemplate;

/** Proves the queue's core guarantee: under concurrent workers, every job runs exactly once. */
class JobQueueConcurrencyIntegrationTest extends AbstractIntegrationTest {

  @Autowired PostgresJobQueue queue;
  @Autowired TransactionTemplate tx;

  record Payload(UUID deploymentId) implements JobPayload {}

  @Test
  void eachJobIsClaimedByExactlyOneOfManyWorkers() throws Exception {
    int jobs = 60;
    for (int i = 0; i < jobs; i++) {
      queue.enqueue(JobType.BUILD, new Payload(UUID.randomUUID()), "concurrency-" + i);
    }

    Map<UUID, String> claimedBy = new ConcurrentHashMap<>();
    AtomicInteger duplicates = new AtomicInteger();
    int workers = 6;
    ExecutorService pool = Executors.newFixedThreadPool(workers);
    CountDownLatch start = new CountDownLatch(1);
    for (int w = 0; w < workers; w++) {
      String workerId = "worker-" + w;
      pool.submit(
          () -> {
            start.await();
            Optional<Job> job;
            while ((job = queue.claim(workerId, Duration.ofMinutes(5))).isPresent()) {
              if (claimedBy.putIfAbsent(job.get().id(), workerId) != null) {
                duplicates.incrementAndGet();
              }
              queue.complete(job.get().id());
            }
            return null;
          });
    }
    start.countDown();
    pool.shutdown();
    assertThat(pool.awaitTermination(60, TimeUnit.SECONDS)).isTrue();

    assertThat(duplicates).hasValue(0);
    assertThat(claimedBy).hasSize(jobs);
    assertThat(claimedBy.values().stream().distinct().count()).isGreaterThan(1);
    assertThat(queue.countByStatus("SUCCEEDED")).isEqualTo(jobs);
  }

  @Test
  void sameIdempotencyKeyEnqueuesOnce() {
    UUID id = UUID.randomUUID();
    queue.enqueue(JobType.BUILD, new Payload(id), "build:" + id);
    queue.enqueue(JobType.BUILD, new Payload(id), "build:" + id);
    assertThat(queue.countByStatus("PENDING")).isEqualTo(1);
  }

  @Test
  void failedJobIsRetriedLaterThenDeadLettered() {
    queue.enqueue(JobType.DEPLOY, new Payload(UUID.randomUUID()), "retry-me");
    Job first = queue.claim("w", Duration.ofMinutes(5)).orElseThrow();
    queue.retryLater(first, "docker unavailable");

    // backoff: not claimable yet
    assertThat(queue.claim("w", Duration.ofMinutes(5))).isEmpty();
    jdbc.update("update jobs set run_after = now() - interval '1 second'");
    Job second = queue.claim("w", Duration.ofMinutes(5)).orElseThrow();
    assertThat(second.attempts()).isEqualTo(2);

    queue.fail(second.id(), true, "gave up");
    assertThat(queue.countByStatus("DEAD")).isEqualTo(1);
  }

  @Test
  void abandonedJobIsReclaimedAfterItsLeaseExpires() {
    queue.enqueue(JobType.BUILD, new Payload(UUID.randomUUID()), "crashy");
    Job job = queue.claim("crashed-worker", Duration.ofMinutes(5)).orElseThrow();
    // simulate the worker dying: its lease runs out without heartbeats
    jdbc.update("update jobs set locked_until = now() - interval '1 second' where id = ?", job.id());

    List<Job> dead = queue.reapExpiredLeases();

    assertThat(dead).isEmpty();
    Job reclaimed = queue.claim("healthy-worker", Duration.ofMinutes(5)).orElseThrow();
    assertThat(reclaimed.id()).isEqualTo(job.id());
  }

  @Test
  void enqueueRollsBackWithTheCallersTransaction() {
    try {
      tx.executeWithoutResult(
          status -> {
            queue.enqueue(JobType.BUILD, new Payload(UUID.randomUUID()), "rolled-back");
            throw new IllegalStateException("business step failed");
          });
    } catch (IllegalStateException expected) {
      // the job must vanish with the transaction
    }
    assertThat(queue.countByStatus("PENDING")).isZero();
  }
}
