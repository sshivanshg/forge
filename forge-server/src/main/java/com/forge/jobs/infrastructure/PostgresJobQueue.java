package com.forge.jobs.infrastructure;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.forge.jobs.Job;
import com.forge.jobs.JobQueue;
import com.forge.jobs.JobType;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Component;

/**
 * Postgres used as a job queue.
 *
 * <ul>
 *   <li><b>Transactional enqueue</b>: the insert joins the caller's transaction.
 *   <li><b>Safe concurrent claiming</b>: {@code FOR UPDATE SKIP LOCKED} lets many workers poll at
 *       once; a row locked by one worker is skipped by the others instead of blocking them.
 *   <li><b>Leases</b>: a claimed job is owned until {@code locked_until}; if the worker dies, the
 *       reaper hands the job to someone else.
 *   <li><b>Retries</b> with exponential backoff, then {@code DEAD} (our dead-letter state).
 * </ul>
 */
@Component
public class PostgresJobQueue implements JobQueue {

  static final Duration BASE_BACKOFF = Duration.ofSeconds(10);
  static final Duration MAX_BACKOFF = Duration.ofMinutes(5);
  private static final int MAX_ERROR_LENGTH = 4_000;

  private static final RowMapper<Job> JOB =
      (rs, i) ->
          new Job(
              rs.getObject("id", UUID.class),
              JobType.valueOf(rs.getString("type")),
              rs.getString("payload"),
              rs.getInt("attempts"),
              rs.getInt("max_attempts"));

  private final JdbcTemplate jdbc;
  private final ObjectMapper objectMapper;
  private final Clock clock;

  public PostgresJobQueue(JdbcTemplate jdbc, ObjectMapper objectMapper, Clock clock) {
    this.jdbc = jdbc;
    this.objectMapper = objectMapper;
    this.clock = clock;
  }

  @Override
  public void enqueue(JobType type, Object payload, String idempotencyKey) {
    jdbc.update(
        """
        insert into jobs (id, type, payload, idempotency_key, run_after, created_at)
        values (?, ?, cast(? as jsonb), ?, ?, ?)
        on conflict (idempotency_key) do nothing
        """,
        UUID.randomUUID(),
        type.name(),
        toJson(payload),
        idempotencyKey,
        now(),
        now());
  }

  /** Atomically takes the oldest runnable job, or nothing. */
  public Optional<Job> claim(String workerId, Duration lease) {
    List<Job> claimed =
        jdbc.query(
            """
            update jobs
               set status = 'RUNNING', locked_by = ?, locked_until = ?, attempts = attempts + 1
             where id = (select id from jobs
                          where status = 'PENDING' and run_after <= ?
                          order by created_at
                          for update skip locked
                          limit 1)
            returning id, type, payload::text as payload, attempts, max_attempts
            """,
            JOB,
            workerId,
            Timestamp.from(clock.instant().plus(lease)),
            now());
    return claimed.stream().findFirst();
  }

  public void complete(UUID jobId) {
    jdbc.update(
        "update jobs set status = 'SUCCEEDED', locked_by = null, locked_until = null, finished_at"
            + " = ? where id = ?",
        now(),
        jobId);
  }

  /** Puts the job back with exponential backoff: 10 s, 20 s, 40 s … capped at 5 min. */
  public void retryLater(Job job, String error) {
    jdbc.update(
        "update jobs set status = 'PENDING', locked_by = null, locked_until = null, run_after = ?,"
            + " last_error = ? where id = ?",
        Timestamp.from(clock.instant().plus(backoff(job.attempts()))),
        truncate(error),
        job.id());
  }

  /** Re-queues without consuming an attempt (the job never really ran). */
  public void postpone(UUID jobId, Duration delay) {
    jdbc.update(
        "update jobs set status = 'PENDING', locked_by = null, locked_until = null, run_after = ?,"
            + " attempts = greatest(attempts - 1, 0) where id = ?",
        Timestamp.from(clock.instant().plus(delay)),
        jobId);
  }

  /** Terminal failure. DEAD = gave up after retries; FAILED = error was not retryable. */
  public void fail(UUID jobId, boolean dead, String error) {
    jdbc.update(
        "update jobs set status = ?, locked_by = null, locked_until = null, last_error = ?,"
            + " finished_at = ? where id = ?",
        dead ? "DEAD" : "FAILED",
        truncate(error),
        now(),
        jobId);
  }

  /** Extends the lease while a long job is still making progress. */
  public void heartbeat(UUID jobId, String workerId, Duration lease) {
    jdbc.update(
        "update jobs set locked_until = ? where id = ? and locked_by = ? and status = 'RUNNING'",
        Timestamp.from(clock.instant().plus(lease)),
        jobId,
        workerId);
  }

  /**
   * Finds jobs whose worker stopped heartbeating (crashed). Jobs with attempts left go back to
   * PENDING; the rest are returned so their handlers can record the failure.
   */
  public List<Job> reapExpiredLeases() {
    jdbc.update(
        "update jobs set status = 'PENDING', locked_by = null, locked_until = null, last_error ="
            + " 'worker lease expired' where status = 'RUNNING' and locked_until < ? and attempts"
            + " < max_attempts",
        now());
    return jdbc.query(
        """
        update jobs set status = 'DEAD', locked_by = null, locked_until = null,
               last_error = 'worker lease expired', finished_at = ?
         where status = 'RUNNING' and locked_until < ? and attempts >= max_attempts
        returning id, type, payload::text as payload, attempts, max_attempts
        """,
        JOB,
        now(),
        now());
  }

  public int countByStatus(String status) {
    Integer count =
        jdbc.queryForObject("select count(*) from jobs where status = ?", Integer.class, status);
    return count == null ? 0 : count;
  }

  static Duration backoff(int attempts) {
    long factor = 1L << Math.min(Math.max(attempts - 1, 0), 10);
    Duration delay = BASE_BACKOFF.multipliedBy(factor);
    return delay.compareTo(MAX_BACKOFF) > 0 ? MAX_BACKOFF : delay;
  }

  private Timestamp now() {
    return Timestamp.from(clock.instant());
  }

  private String toJson(Object payload) {
    try {
      return objectMapper.writeValueAsString(payload);
    } catch (JsonProcessingException e) {
      throw new IllegalArgumentException("Job payload is not serialisable", e);
    }
  }

  private static String truncate(String error) {
    if (error == null) {
      return null;
    }
    return error.length() > MAX_ERROR_LENGTH ? error.substring(0, MAX_ERROR_LENGTH) : error;
  }

  Instant clockNow() {
    return clock.instant();
  }
}
