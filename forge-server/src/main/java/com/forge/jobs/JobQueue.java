package com.forge.jobs;

/**
 * Port for durable background work. Callers depend on this interface only (Dependency Inversion):
 * today it is backed by Postgres; a Kafka implementation could replace it without changing them.
 */
public interface JobQueue {

  /**
   * Adds a job in the caller's current transaction, so "save the deployment" and "queue its build"
   * either both happen or neither does.
   *
   * @param idempotencyKey unique key; enqueuing the same key twice is a no-op
   */
  void enqueue(JobType type, Object payload, String idempotencyKey);
}
