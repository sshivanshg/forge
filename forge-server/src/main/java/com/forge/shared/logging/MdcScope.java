package com.forge.shared.logging;

import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.MDC;

/**
 * Puts values into the MDC for the duration of a try-with-resources block and restores the previous
 * values afterwards, so logging context never leaks between jobs on a pooled thread.
 */
public final class MdcScope implements AutoCloseable {

  private final Map<String, String> previous = new LinkedHashMap<>();

  private MdcScope(Map<String, String> values) {
    values.forEach(
        (key, value) -> {
          previous.put(key, MDC.get(key));
          MDC.put(key, value);
        });
  }

  public static MdcScope of(String key, Object value) {
    return new MdcScope(Map.of(key, String.valueOf(value)));
  }

  public static MdcScope of(String k1, Object v1, String k2, Object v2) {
    Map<String, String> values = new LinkedHashMap<>();
    values.put(k1, String.valueOf(v1));
    values.put(k2, String.valueOf(v2));
    return new MdcScope(values);
  }

  @Override
  public void close() {
    previous.forEach(
        (key, value) -> {
          if (value == null) {
            MDC.remove(key);
          } else {
            MDC.put(key, value);
          }
        });
  }
}
