package com.forge.source.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Remembers every processed GitHub delivery id. GitHub retries deliveries, so the primary key turns
 * "process this webhook" into an idempotent operation.
 */
@Entity
@Table(name = "webhook_deliveries")
public class WebhookDelivery {

  @Id
  @Column(name = "delivery_id")
  private String deliveryId;

  @Column(name = "event_type", nullable = false)
  private String eventType;

  @Column(name = "received_at", nullable = false)
  private Instant receivedAt;

  protected WebhookDelivery() {
    // for JPA
  }

  public WebhookDelivery(String deliveryId, String eventType, Instant receivedAt) {
    this.deliveryId = deliveryId;
    this.eventType = eventType;
    this.receivedAt = receivedAt;
  }
}
