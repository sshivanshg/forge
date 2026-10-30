package com.forge.source;

/** A repository on the configured Git host, identified by owner and name. */
public record GitRepository(String owner, String name) {

  public String fullName() {
    return owner + "/" + name;
  }
}
