package com.forge.build;

import com.forge.source.CommitInfo;

/**
 * @param imageRef fully qualified image, e.g. {@code localhost:5001/forge/hello:3f2a9c1b0d4e}
 * @param detectedType the build type actually used (resolved when the project says AUTO)
 * @param commit the commit that was built
 */
public record BuildResult(String imageRef, BuildType detectedType, CommitInfo commit) {}
