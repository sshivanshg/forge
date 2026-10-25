package com.forge.build;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.forge.build.BuildFailedException.Reason;
import com.forge.build.application.ImageBuilder;
import com.forge.build.application.RetryingImageBuilder;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;

class RetryingImageBuilderTest {

  /** Fails the first {@code failures} pushes, then succeeds. */
  static final class FlakyRegistry implements ImageBuilder {
    int failures;
    int pushes;
    int builds;

    FlakyRegistry(int failures) {
      this.failures = failures;
    }

    @Override
    public void build(Path c, Path d, String image, Duration t, Consumer<String> out) {
      builds++;
      throw new BuildFailedException(Reason.BUILD_FAILED, "compile error");
    }

    @Override
    public void push(String image, Consumer<String> out) {
      pushes++;
      if (failures-- > 0) {
        throw new BuildFailedException(Reason.PUSH_FAILED, "registry unavailable");
      }
    }
  }

  @Test
  void retriesTransientPushFailures() {
    var registry = new FlakyRegistry(2);
    List<String> output = new ArrayList<>();

    new RetryingImageBuilder(registry, 3, Duration.ZERO).push("img", output::add);

    assertThat(registry.pushes).isEqualTo(3);
    assertThat(output).hasSize(2).allMatch(line -> line.startsWith("Push failed"));
  }

  @Test
  void givesUpAfterMaxAttempts() {
    var registry = new FlakyRegistry(5);
    assertThatThrownBy(
            () -> new RetryingImageBuilder(registry, 3, Duration.ZERO).push("img", l -> {}))
        .isInstanceOf(BuildFailedException.class);
    assertThat(registry.pushes).isEqualTo(3);
  }

  @Test
  void neverRetriesBuilds() {
    var registry = new FlakyRegistry(0);
    assertThatThrownBy(
            () ->
                new RetryingImageBuilder(registry, 3, Duration.ZERO)
                    .build(
                        Path.of("."), Path.of("Dockerfile"), "img", Duration.ofMinutes(1), l -> {}))
        .isInstanceOf(BuildFailedException.class);
    assertThat(registry.builds).isEqualTo(1);
  }
}
