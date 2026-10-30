package com.forge.shared.config;

import org.springframework.stereotype.Component;

/** Builds the public URL and router host name of a deployed app from its project slug. */
@Component
public class AppUrls {

  private final AppsProperties properties;

  public AppUrls(AppsProperties properties) {
    this.properties = properties;
  }

  public String hostFor(String slug) {
    return slug + "." + properties.baseDomain();
  }

  public String urlFor(String slug) {
    int port = properties.publicPort();
    String portSuffix = port == 80 || port == 443 ? "" : ":" + port;
    return properties.scheme() + "://" + hostFor(slug) + portSuffix;
  }
}
