package com.forge.deployment.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class ListeningPortWatchTest {

  @Test
  void readsThePortCommonServersAnnounce() {
    assertThat(ListeningPortWatch.announcedPorts(List.of("Server listening on port 3000")))
        .containsExactly(3000);
    assertThat(
            ListeningPortWatch.announcedPorts(
                List.of(
                    "o.s.b.w.embedded.tomcat.TomcatWebServer : Tomcat started on port 8080 (http)")))
        .containsExactly(8080);
    assertThat(ListeningPortWatch.announcedPorts(List.of("Listening on http://0.0.0.0:5000")))
        .containsExactly(5000);
    assertThat(
            ListeningPortWatch.announcedPorts(List.of("Uvicorn running on http://127.0.0.1:8000")))
        .containsExactly(8000);
  }

  @Test
  void ignoresOutputThatNamesNoListeningPort() {
    assertThat(
            ListeningPortWatch.announcedPorts(
                List.of("Connecting to database on port 5432 failed", "npm WARN deprecated")))
        .isEmpty();
  }
}
