package com.forge.shared.container;

import com.forge.shared.error.ExternalServiceException;
import java.io.BufferedReader;
import java.io.Closeable;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

/**
 * Runs the Apple {@code container} command line, the only interface Apple's container engine offers
 * (there is no Docker-style API socket). The build and runtime adapters use it; nothing else should
 * start processes.
 *
 * <p>Arguments are passed as a list, never through a shell, so values can't be interpreted as shell
 * syntax.
 */
public class ContainerCli {

  /** Exit code and combined stdout/stderr lines of a finished command. */
  public record Result(int exitCode, List<String> output) {
    public boolean ok() {
      return exitCode == 0;
    }

    public String text() {
      return String.join("\n", output);
    }
  }

  /** Thrown when a command runs longer than its timeout; the process has been killed. */
  public static class TimeoutException extends RuntimeException {
    TimeoutException(String message) {
      super(message);
    }
  }

  private final String binary;

  public ContainerCli(String binary) {
    this.binary = binary;
  }

  /** Runs a short command and collects its output. */
  public Result run(Duration timeout, String... args) {
    List<String> output = new ArrayList<>();
    int exit = stream(timeout, output::add, args);
    return new Result(exit, List.copyOf(output));
  }

  /** Runs a command, passing each output line to {@code lines}; returns the exit code. */
  public int stream(Duration timeout, Consumer<String> lines, String... args) {
    Process process = start(args);
    Thread reader = Thread.ofVirtual().start(() -> pump(process, lines));
    try {
      if (!process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS)) {
        process.destroyForcibly();
        throw new TimeoutException(
            "`container " + args[0] + "` did not finish within " + timeout.toSeconds() + " s");
      }
      reader.join(Duration.ofSeconds(5));
      return process.exitValue();
    } catch (InterruptedException e) {
      process.destroyForcibly();
      Thread.currentThread().interrupt();
      throw new ExternalServiceException("Interrupted while running container " + args[0], e);
    }
  }

  /** Starts a long-running command (e.g. following logs); closing the handle stops it. */
  public Closeable follow(Consumer<String> lines, String... args) {
    Process process = start(args);
    Thread.ofVirtual().start(() -> pump(process, lines));
    return process::destroy;
  }

  private Process start(String... args) {
    List<String> command = new ArrayList<>(args.length + 1);
    command.add(binary);
    command.addAll(List.of(args));
    try {
      return new ProcessBuilder(command).redirectErrorStream(true).start();
    } catch (IOException e) {
      throw new ExternalServiceException(
          "Could not run `" + binary + "`. Is Apple container installed and started?", e);
    }
  }

  private static void pump(Process process, Consumer<String> lines) {
    try (BufferedReader reader =
        new BufferedReader(
            new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
      String line;
      while ((line = reader.readLine()) != null) {
        if (!line.isBlank()) {
          lines.accept(line);
        }
      }
    } catch (IOException ignored) {
      // the process was stopped; nothing more to read
    }
  }
}
