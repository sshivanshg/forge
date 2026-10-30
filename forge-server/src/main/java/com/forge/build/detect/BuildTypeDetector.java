package com.forge.build.detect;

import com.forge.build.BuildType;
import java.nio.file.Path;
import java.util.Optional;

/**
 * One link of the detection chain (Chain of Responsibility). Each detector recognises exactly one
 * kind of project; the chain asks them in priority order until one answers.
 */
public interface BuildTypeDetector {

  Optional<BuildType> detect(Path sourceDir);
}
