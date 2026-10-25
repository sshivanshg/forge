package com.forge.notification.application;

/**
 * Strategy for delivering a notification (email today; Slack or Discord would be new
 * implementations). The notifier sends to every channel bean.
 */
public interface NotificationChannel {

  String name();

  void send(Notification notification);

  /** What to tell the user. */
  record Notification(String recipient, String subject, String body) {}
}
