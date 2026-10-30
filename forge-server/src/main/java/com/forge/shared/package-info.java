/**
 * Cross-cutting building blocks used by every module: error model, web plumbing (correlation ids,
 * problem details, paging), the authenticated principal, encryption, the Docker client and shared
 * configuration.
 *
 * <p>Declared OPEN so all modules may use any of its packages. It must never depend on a business
 * module.
 */
@ApplicationModule(type = ApplicationModule.Type.OPEN)
package com.forge.shared;

import org.springframework.modulith.ApplicationModule;
