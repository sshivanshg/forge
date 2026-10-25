package com.forge.source.infrastructure;

import com.forge.source.domain.WebhookDelivery;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WebhookDeliveryRepository extends JpaRepository<WebhookDelivery, String> {}
