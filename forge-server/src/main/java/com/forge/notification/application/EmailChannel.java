package com.forge.notification.application;

import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/** Sends notifications by SMTP (Mailpit locally: http://localhost:8025). */
@Component
class EmailChannel implements NotificationChannel {

  private final JavaMailSender mail;
  private final NotificationProperties properties;

  EmailChannel(JavaMailSender mail, NotificationProperties properties) {
    this.mail = mail;
    this.properties = properties;
  }

  @Override
  public String name() {
    return "email";
  }

  @Override
  public void send(Notification notification) {
    SimpleMailMessage message = new SimpleMailMessage();
    message.setFrom(properties.from());
    message.setTo(notification.recipient());
    message.setSubject(notification.subject());
    message.setText(notification.body());
    mail.send(message);
  }
}
