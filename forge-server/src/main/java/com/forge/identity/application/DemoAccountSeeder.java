package com.forge.identity.application;

import com.forge.identity.domain.User;
import com.forge.identity.infrastructure.UserRepository;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Creates the demo account ({@code FORGE_DEMO_EMAIL} / {@code FORGE_DEMO_PASSWORD}) at startup, so
 * a fresh install can be shown to anyone with one click on the login page. Does nothing when the
 * account exists or no demo account is configured.
 */
@Component
class DemoAccountSeeder {

  private final IdentityProperties properties;
  private final UserRepository users;
  private final AuthService auth;

  DemoAccountSeeder(IdentityProperties properties, UserRepository users, AuthService auth) {
    this.properties = properties;
    this.users = users;
    this.auth = auth;
  }

  @EventListener(ApplicationReadyEvent.class)
  void seed() {
    if (properties.hasDemoAccount()
        && !users.existsByEmail(User.normaliseEmail(properties.demoEmail()))) {
      auth.register(properties.demoEmail(), properties.demoPassword(), "Demo User");
    }
  }
}
