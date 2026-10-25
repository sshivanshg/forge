package com.forge.build.strategy;

import com.forge.build.BuildType;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Factory: returns the strategy for a build type. Built from all {@link BuildStrategy} beans, so a
 * new stack is supported by adding a bean, with no {@code if/else} or {@code switch} to edit
 * (Open/Closed).
 */
@Component
public class BuildStrategyFactory {

  private final Map<BuildType, BuildStrategy> strategies = new EnumMap<>(BuildType.class);

  public BuildStrategyFactory(List<BuildStrategy> beans) {
    beans.forEach(strategy -> strategies.put(strategy.type(), strategy));
  }

  public BuildStrategy forType(BuildType type) {
    BuildStrategy strategy = strategies.get(type);
    if (strategy == null) {
      throw new IllegalArgumentException("No build strategy for " + type);
    }
    return strategy;
  }
}
