package com.forge.shared.security;

import java.util.UUID;

/**
 * The principal placed in the security context after a valid access token. Controllers receive it
 * with {@code @AuthenticationPrincipal AuthenticatedUser user}.
 */
public record AuthenticatedUser(UUID id, String email) {}
