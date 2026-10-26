package com.forge.agent;

import static org.assertj.core.api.Assertions.assertThat;

import com.forge.agent.domain.Diagnosis;
import com.forge.agent.domain.Diagnosis.Confidence;
import com.forge.agent.domain.DiagnosisRule;
import com.forge.agent.domain.DiagnosisRules;
import com.forge.agent.domain.FailureContext;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DiagnosisRulesTest {

  private final List<DiagnosisRule> rules = DiagnosisRules.defaults();

  @Test
  void spotsPortMismatchFromTheAppsOwnStartupLog() {
    Diagnosis d =
        diagnose(
            "UNHEALTHY",
            "process exited (ConnectException)",
            "> node server.js",
            "Server listening on port 3000");

    assertThat(d.category()).isEqualTo("PORT_MISMATCH");
    assertThat(d.summary()).contains("3000").contains("8080");
    assertThat(d.confidence()).isEqualTo(Confidence.HIGH);
    assertThat(d.evidence()).containsExactly("Server listening on port 3000");
  }

  @Test
  void healthPathReturning404() {
    assertThat(diagnose("UNHEALTHY", "timed out; last: HTTP 404 from /health").category())
        .isEqualTo("HEALTH_PATH_NOT_FOUND");
  }

  @Test
  void compilationErrorQuotesTheFirstError() {
    Diagnosis d =
        diagnose(
            "BUILD_FAILED",
            "docker build failed",
            "[INFO] Compiling 12 source files",
            "[ERROR] /src/App.java:[10,5] cannot find symbol");
    assertThat(d.category()).isEqualTo("COMPILATION_ERROR");
    assertThat(d.summary()).contains("cannot find symbol");
  }

  @Test
  void dockerEngineFaultIsNotBlamedOnTheCode() {
    Diagnosis d =
        diagnose(
            "BUILD_FAILED",
            "docker build failed: Could not build image: failed to stat parent",
            "ERROR: failed to stat parent: stat /var/lib/desktop-containerd/daemon/"
                + "io.containerd.snapshotter.v1.overlayfs/snapshots/427/fs: no such file or directory");

    assertThat(d.category()).isEqualTo("PLATFORM_ERROR");
    assertThat(d.summary()).contains("not your code");
  }

  @Test
  void outOfMemoryFromExitCode137() {
    assertThat(diagnose("UNHEALTHY", "process exited; container exited with code 137").category())
        .isEqualTo("OUT_OF_MEMORY");
  }

  @Test
  void missingDatabaseConfiguration() {
    assertThat(
            diagnose(
                    "UNHEALTHY",
                    "process exited; container exited with code 1",
                    "Failed to configure a DataSource: 'url' attribute is not specified")
                .category())
        .isEqualTo("MISSING_CONFIGURATION");
  }

  @Test
  void crashOnStartupQuotesTheException() {
    Diagnosis d =
        diagnose(
            "UNHEALTHY",
            "process exited (x); container exited with code 1",
            "Exception in thread \"main\" java.lang.IllegalStateException: boom");
    assertThat(d.category()).isEqualTo("CRASH_ON_STARTUP");
    assertThat(d.summary()).contains("boom");
  }

  @Test
  void alwaysAnswersEvenWithNoClues() {
    Diagnosis d = diagnose("INTERNAL_ERROR", "something odd");
    assertThat(d.category()).isEqualTo("UNKNOWN");
    assertThat(d.confidence()).isEqualTo(Confidence.LOW);
  }

  private Diagnosis diagnose(String reason, String detail, String... logs) {
    FailureContext context =
        new FailureContext(
            UUID.randomUUID(),
            "demo",
            reason,
            detail,
            "NODE",
            8080,
            "/health",
            "a".repeat(40),
            "msg",
            List.of(logs));
    return rules.stream()
        .map(rule -> rule.evaluate(context))
        .flatMap(Optional::stream)
        .findFirst()
        .orElseThrow();
  }
}
