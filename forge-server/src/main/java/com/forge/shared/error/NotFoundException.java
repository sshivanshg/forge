package com.forge.shared.error;

/**
 * A resource does not exist <em>or does not belong to the caller</em>. We deliberately answer 404
 * in both cases so ids of other users' resources cannot be probed.
 */
public class NotFoundException extends ForgeException {

  public NotFoundException(String resource, Object id) {
    super(ErrorCode.NOT_FOUND, resource + " " + id + " not found");
  }
}
