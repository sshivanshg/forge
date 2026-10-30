package com.forge.project.domain;

import com.forge.shared.error.ValidationException;
import java.util.regex.Pattern;

/** Value object: a GitHub repository, e.g. {@code sshivanshg/hello-spring}. */
public record RepoRef(String owner, String name) {

  private static final Pattern PART = Pattern.compile("^[A-Za-z0-9_.-]{1,100}$");

  public RepoRef {
    if (owner == null || !PART.matcher(owner).matches()) {
      throw new ValidationException("repoOwner is not a valid GitHub owner name");
    }
    if (name == null || !PART.matcher(name).matches() || name.equals(".") || name.equals("..")) {
      throw new ValidationException("repoName is not a valid GitHub repository name");
    }
  }

  public String fullName() {
    return owner + "/" + name;
  }
}
