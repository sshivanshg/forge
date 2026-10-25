package com.forge.agent.domain;

import com.forge.agent.domain.Diagnosis.Confidence;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The built-in rules, most specific first. Pure functions over a {@link FailureContext}: easy to
 * unit test and to extend (one new class per new kind of failure).
 */
public final class DiagnosisRules {

  private DiagnosisRules() {}

  /** Ordered rule set; the last rule always matches. */
  public static List<DiagnosisRule> defaults() {
    return List.of(
        new SourceUnavailable(),
        new UnsupportedProject(),
        new BuildTimeout(),
        new OutOfMemory(),
        new MissingStartScript(),
        new DependencyResolution(),
        new CompilationError(),
        new PortMismatch(),
        new HealthPathNotFound(),
        new MissingConfiguration(),
        new CrashOnStartup(),
        new Generic());
  }

  static final class SourceUnavailable implements DiagnosisRule {
    @Override
    public Optional<Diagnosis> evaluate(FailureContext c) {
      if (!c.failedWith("SOURCE_UNAVAILABLE")) {
        return Optional.empty();
      }
      return Optional.of(
          new Diagnosis(
              "SOURCE_UNAVAILABLE",
              "Forge could not fetch the code: " + c.failureDetail(),
              "Check the repository owner/name and branch in project settings. If the repository is"
                  + " private, connect your GitHub account in Settings.",
              Confidence.HIGH,
              List.of(c.failureDetail())));
    }
  }

  static final class UnsupportedProject implements DiagnosisRule {
    @Override
    public Optional<Diagnosis> evaluate(FailureContext c) {
      if (!c.failedWith("UNSUPPORTED_PROJECT")) {
        return Optional.empty();
      }
      return Optional.of(
          new Diagnosis(
              "UNSUPPORTED_PROJECT",
              "Forge could not tell how to build this repository.",
              "Make sure the project's root directory contains a Dockerfile, pom.xml, build.gradle"
                  + " or package.json, or set the root directory to the folder that does.",
              Confidence.HIGH,
              List.of(c.failureDetail())));
    }
  }

  static final class BuildTimeout implements DiagnosisRule {
    @Override
    public Optional<Diagnosis> evaluate(FailureContext c) {
      if (!c.failedWith("BUILD_TIMEOUT")) {
        return Optional.empty();
      }
      return Optional.of(
          new Diagnosis(
              "BUILD_TIMEOUT",
              "The build took longer than the allowed time and was stopped.",
              "Skip tests during the image build, reduce dependencies, or commit a Dockerfile that"
                  + " uses a smaller base image.",
              Confidence.HIGH,
              List.of(c.failureDetail())));
    }
  }

  static final class OutOfMemory implements DiagnosisRule {
    @Override
    public Optional<Diagnosis> evaluate(FailureContext c) {
      List<String> evidence =
          c.linesContaining("outofmemoryerror", "out of memory", "javascript heap out of memory");
      boolean oomKilled =
          c.searchableText().contains("killed: out of memory")
              || c.searchableText().contains("exited with code 137");
      if (evidence.isEmpty() && !oomKilled) {
        return Optional.empty();
      }
      return Optional.of(
          new Diagnosis(
              "OUT_OF_MEMORY",
              "The app ran out of memory (container limit is 512 MB).",
              "Reduce memory use at startup (for Java: lower -Xmx or use fewer threads; for Node:"
                  + " avoid loading large data at boot), or ask the operator for a higher limit.",
              Confidence.HIGH,
              evidence.isEmpty() ? List.of(c.failureDetail()) : evidence));
    }
  }

  static final class MissingStartScript implements DiagnosisRule {
    @Override
    public Optional<Diagnosis> evaluate(FailureContext c) {
      List<String> evidence =
          c.linesContaining("missing script: \"start\"", "missing script: start");
      if (evidence.isEmpty()) {
        return Optional.empty();
      }
      return Optional.of(
          new Diagnosis(
              "MISSING_START_SCRIPT",
              "package.json has no \"start\" script, so the container has nothing to run.",
              "Add a start script to package.json, for example \"start\": \"node server.js\".",
              Confidence.HIGH,
              evidence));
    }
  }

  static final class DependencyResolution implements DiagnosisRule {
    @Override
    public Optional<Diagnosis> evaluate(FailureContext c) {
      if (!c.failedWith("BUILD_FAILED")) {
        return Optional.empty();
      }
      List<String> evidence =
          c.linesContaining(
              "npm err! code eresolve",
              "npm error code eresolve",
              "could not resolve dependencies",
              "could not find artifact",
              "404 not found",
              "no matching version found");
      if (evidence.isEmpty()) {
        return Optional.empty();
      }
      return Optional.of(
          new Diagnosis(
              "DEPENDENCY_RESOLUTION",
              "A dependency could not be downloaded or resolved during the build.",
              "Check the dependency names and versions in your manifest, commit your lock file"
                  + " (package-lock.json), and make sure the build works locally from a clean clone.",
              Confidence.MEDIUM,
              evidence));
    }
  }

  static final class CompilationError implements DiagnosisRule {
    @Override
    public Optional<Diagnosis> evaluate(FailureContext c) {
      if (!c.failedWith("BUILD_FAILED")) {
        return Optional.empty();
      }
      List<String> evidence =
          c.linesContaining(
              "compilation error",
              "cannot find symbol",
              "error: ",
              "[error]",
              "syntaxerror",
              "error ts",
              "failed to compile");
      if (evidence.isEmpty()) {
        return Optional.empty();
      }
      return Optional.of(
          new Diagnosis(
              "COMPILATION_ERROR",
              "The code does not compile. First error: " + evidence.getFirst(),
              "Fix the error shown above (run the build locally to reproduce), commit, and push"
                  + " again.",
              Confidence.HIGH,
              evidence));
    }
  }

  /** The app started but listens on a different port than the project is configured with. */
  static final class PortMismatch implements DiagnosisRule {
    private static final Pattern LISTENING =
        Pattern.compile(
            "(?i)(?:listening|started|running|serving|server)[^\\n]{0,60}?(?:port\\s*|:)(\\d{2,5})\\b");

    @Override
    public Optional<Diagnosis> evaluate(FailureContext c) {
      if (!c.failedWith("UNHEALTHY")) {
        return Optional.empty();
      }
      for (String line : c.logLines()) {
        Matcher m = LISTENING.matcher(line);
        if (m.find()) {
          int actual = Integer.parseInt(m.group(1));
          if (actual != c.configuredPort() && actual > 0 && actual < 65536) {
            return Optional.of(
                new Diagnosis(
                    "PORT_MISMATCH",
                    "The app listens on port "
                        + actual
                        + " but the project expects port "
                        + c.configuredPort()
                        + ", so health checks could not reach it.",
                    "Either change the project's port to "
                        + actual
                        + " in Settings, or make the app read the PORT environment variable"
                        + " (Forge sets PORT="
                        + c.configuredPort()
                        + ").",
                    Confidence.HIGH,
                    List.of(line)));
          }
        }
      }
      return Optional.empty();
    }
  }

  static final class HealthPathNotFound implements DiagnosisRule {
    @Override
    public Optional<Diagnosis> evaluate(FailureContext c) {
      if (!c.failedWith("UNHEALTHY") || !c.failureDetail().contains("HTTP 404")) {
        return Optional.empty();
      }
      return Optional.of(
          new Diagnosis(
              "HEALTH_PATH_NOT_FOUND",
              "The app is running, but " + c.healthCheckPath() + " returns 404 Not Found.",
              "Set the health check path in project settings to a route that returns 200 (for"
                  + " Spring Boot with Actuator: /actuator/health), or add that route to the app.",
              Confidence.HIGH,
              List.of(c.failureDetail())));
    }
  }

  static final class MissingConfiguration implements DiagnosisRule {
    @Override
    public Optional<Diagnosis> evaluate(FailureContext c) {
      List<String> evidence =
          c.linesContaining(
              "could not resolve placeholder",
              "environment variable",
              "is not defined",
              "missing required",
              "connection refused: localhost/127.0.0.1:5432",
              "econnrefused 127.0.0.1",
              "failed to configure a datasource");
      if (evidence.isEmpty()) {
        return Optional.empty();
      }
      return Optional.of(
          new Diagnosis(
              "MISSING_CONFIGURATION",
              "The app is missing configuration it needs at startup (an environment variable or"
                  + " a database connection).",
              "Add the required values under the project's Environment tab (for example"
                  + " DATABASE_URL), then redeploy. Remember: localhost inside the container is"
                  + " the container itself.",
              Confidence.MEDIUM,
              evidence));
    }
  }

  static final class CrashOnStartup implements DiagnosisRule {
    @Override
    public Optional<Diagnosis> evaluate(FailureContext c) {
      if (!c.failedWith("UNHEALTHY") || !c.failureDetail().contains("exited")) {
        return Optional.empty();
      }
      List<String> evidence = c.linesContaining("exception", "error", "fatal", "panic");
      String first = evidence.isEmpty() ? c.failureDetail() : evidence.getFirst();
      return Optional.of(
          new Diagnosis(
              "CRASH_ON_STARTUP",
              "The app crashed while starting: " + first,
              "Run the app locally with the same environment variables to reproduce the error"
                  + " above, fix it, and push again. The previous version is still live.",
              evidence.isEmpty() ? Confidence.LOW : Confidence.MEDIUM,
              evidence.isEmpty() ? List.of(c.failureDetail()) : evidence));
    }
  }

  static final class Generic implements DiagnosisRule {
    @Override
    public Optional<Diagnosis> evaluate(FailureContext c) {
      List<String> evidence = c.linesContaining("error", "exception", "failed");
      return Optional.of(
          new Diagnosis(
              "UNKNOWN",
              "The deployment failed with " + c.failureReason() + ". " + c.failureDetail(),
              "Read the highlighted log lines; the first error is usually the cause. Fix it and"
                  + " redeploy, or roll back to the last working deployment.",
              Confidence.LOW,
              evidence.isEmpty() ? List.of(c.failureDetail()) : evidence));
    }
  }
}
