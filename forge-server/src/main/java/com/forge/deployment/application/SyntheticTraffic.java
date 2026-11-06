package com.forge.deployment.application;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URI;
import java.nio.charset.StandardCharsets;

/**
 * Sends test requests to an app <em>through the reverse proxy</em>, so they are split and measured
 * exactly like visitors' requests. Used during a canary rollout so even an app nobody is visiting
 * produces enough traffic to compare the two versions.
 *
 * <p>Written on a plain socket because {@code java.net.http} does not let callers set the Host
 * header, which is how the proxy picks the app.
 */
final class SyntheticTraffic {

  private static final int CONNECT_TIMEOUT_MS = 1_000;
  private static final int READ_TIMEOUT_MS = 5_000;

  private final String proxyHost;
  private final int proxyPort;

  SyntheticTraffic(String proxyUrl) {
    URI uri = URI.create(proxyUrl);
    this.proxyHost = uri.getHost();
    this.proxyPort = uri.getPort() > 0 ? uri.getPort() : 80;
  }

  /** One {@code GET /} for {@code host}. Returns the HTTP status, or -1 if there was no answer. */
  int get(String host) {
    try (Socket socket = new Socket()) {
      socket.connect(new InetSocketAddress(proxyHost, proxyPort), CONNECT_TIMEOUT_MS);
      socket.setSoTimeout(READ_TIMEOUT_MS);
      OutputStream out = socket.getOutputStream();
      out.write(
          ("GET / HTTP/1.1\r\nHost: "
                  + host
                  + "\r\nUser-Agent: forge-canary\r\nConnection: close\r\n\r\n")
              .getBytes(StandardCharsets.US_ASCII));
      out.flush();
      InputStream in = socket.getInputStream();
      byte[] response = in.readNBytes(64 * 1024); // read to the end so the proxy logs a full reply
      String statusLine =
          new String(response, 0, Math.min(response.length, 16), StandardCharsets.US_ASCII);
      return statusLine.startsWith("HTTP/1.") && statusLine.length() >= 12
          ? Integer.parseInt(statusLine.substring(9, 12))
          : -1;
    } catch (IOException | NumberFormatException e) {
      return -1;
    }
  }
}
