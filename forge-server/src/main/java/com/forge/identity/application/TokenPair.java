package com.forge.identity.application;

/** Result of a successful login or refresh. */
public record TokenPair(String accessToken, String refreshToken, long expiresIn) {}
