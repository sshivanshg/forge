package com.forge.logs.infrastructure;

import com.forge.logs.LogLine;
import com.forge.logs.LogReader;
import com.forge.logs.LogSink;
import com.forge.logs.LogSource;
import com.forge.logs.application.LogBroadcaster;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Component;

/**
 * Stores log lines in Postgres with plain JDBC (high-volume inserts do not need JPA) and forwards
 * each stored line to the live broadcaster.
 *
 * <p>Sequence numbers come from an in-memory counter per deployment, seeded from the database the
 * first time it is needed. That is safe because only one worker writes a deployment's logs at a
 * time; with several workers this would move to a database sequence.
 */
@Component
class JdbcLogStore implements LogSink, LogReader {

  private static final int MAX_LINE_LENGTH = 4_000;
  private static final Pattern ANSI = Pattern.compile("\u001B\\[[;\\d]*[ -/]*[@-~]");

  private static final RowMapper<LogLine> ROW =
      (rs, i) ->
          new LogLine(
              rs.getInt("seq"),
              LogSource.valueOf(rs.getString("source")),
              rs.getString("line"),
              rs.getTimestamp("ts").toInstant());

  private final JdbcTemplate jdbc;
  private final LogBroadcaster broadcaster;
  private final Clock clock;
  private final Map<UUID, AtomicInteger> counters = new ConcurrentHashMap<>();

  JdbcLogStore(JdbcTemplate jdbc, LogBroadcaster broadcaster, Clock clock) {
    this.jdbc = jdbc;
    this.broadcaster = broadcaster;
    this.clock = clock;
    broadcaster.onTerminal(counters::remove);
  }

  @Override
  public void append(UUID deploymentId, LogSource source, String text) {
    if (text == null) {
      return;
    }
    for (String raw : text.split("\\r?\\n")) {
      String line = clean(raw);
      if (line.isBlank()) {
        continue;
      }
      int seq = counter(deploymentId).incrementAndGet();
      Instant now = clock.instant();
      jdbc.update(
          "insert into log_lines (deployment_id, source, seq, line, ts) values (?, ?, ?, ?, ?)",
          deploymentId,
          source.name(),
          seq,
          line,
          Timestamp.from(now));
      broadcaster.publishLine(deploymentId, new LogLine(seq, source, line, now));
    }
  }

  @Override
  public List<LogLine> after(UUID deploymentId, int afterSeq, int limit) {
    return jdbc.query(
        "select seq, source, line, ts from log_lines where deployment_id = ? and seq > ? order by"
            + " seq limit ?",
        ROW,
        deploymentId,
        afterSeq,
        limit);
  }

  @Override
  public List<LogLine> tail(UUID deploymentId, int count) {
    List<LogLine> newestFirst =
        jdbc.query(
            "select seq, source, line, ts from log_lines where deployment_id = ? order by seq desc"
                + " limit ?",
            ROW,
            deploymentId,
            count);
    return newestFirst.reversed();
  }

  private AtomicInteger counter(UUID deploymentId) {
    return counters.computeIfAbsent(
        deploymentId,
        id -> {
          Integer max =
              jdbc.queryForObject(
                  "select coalesce(max(seq), 0) from log_lines where deployment_id = ?",
                  Integer.class,
                  id);
          return new AtomicInteger(max == null ? 0 : max);
        });
  }

  static String clean(String raw) {
    String line = ANSI.matcher(raw).replaceAll("").stripTrailing();
    return line.length() > MAX_LINE_LENGTH ? line.substring(0, MAX_LINE_LENGTH) + " …" : line;
  }
}
