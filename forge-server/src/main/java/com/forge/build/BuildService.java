package com.forge.build;

/**
 * Public API of the build module: turn one exact commit of a repository into a container image in
 * the registry. Build output is streamed to the deployment's logs while it runs.
 */
public interface BuildService {

  /**
   * @throws BuildFailedException when the source cannot be fetched, the build fails or times out,
   *     or the image cannot be pushed
   */
  BuildResult build(BuildRequest request);
}
