package demo;

import java.time.Instant;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Demo Spring Boot app deployed by Forge. Health check path: /actuator/health */
@SpringBootApplication
@RestController
public class HelloApplication {

  private final Instant startedAt = Instant.now();

  @Value("${GREETING:Hello from Forge}")
  private String greeting;

  public static void main(String[] args) {
    SpringApplication.run(HelloApplication.class, args);
  }

  @GetMapping("/")
  Map<String, Object> hello() {
    return Map.of("message", greeting, "app", "hello-spring", "version", "v1", "startedAt", startedAt);
  }
}
