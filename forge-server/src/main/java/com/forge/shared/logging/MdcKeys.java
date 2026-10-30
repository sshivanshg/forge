package com.forge.shared.logging;

/** Keys put into the SLF4J MDC so every log line can be filtered by request or deployment. */
public final class MdcKeys {

  public static final String CORRELATION_ID = "correlationId";
  public static final String DEPLOYMENT_ID = "deploymentId";
  public static final String JOB_ID = "jobId";

  private MdcKeys() {}
}
