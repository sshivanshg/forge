package com.forge.notification.application;

import com.forge.deployment.DeploymentStatus;
import com.forge.deployment.DeploymentStatusChanged;
import com.forge.identity.UserLookup;
import com.forge.notification.application.NotificationChannel.Notification;
import com.forge.project.ProjectCatalog;
import com.forge.project.ProjectSnapshot;
import com.forge.shared.config.AppUrls;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Observer: tells the project owner when a deployment goes live or fails. Runs after commit and
 * asynchronously, so a slow or broken mail server can never fail or delay a deployment.
 */
@Component
class DeploymentNotifier {

  private static final Logger log = LoggerFactory.getLogger(DeploymentNotifier.class);

  private final List<NotificationChannel> channels;
  private final ProjectCatalog projects;
  private final UserLookup users;
  private final AppUrls appUrls;
  private final NotificationProperties properties;

  DeploymentNotifier(
      List<NotificationChannel> channels,
      ProjectCatalog projects,
      UserLookup users,
      AppUrls appUrls,
      NotificationProperties properties) {
    this.channels = channels;
    this.projects = projects;
    this.users = users;
    this.appUrls = appUrls;
    this.properties = properties;
  }

  @Async
  @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
  public void onStatusChanged(DeploymentStatusChanged event) {
    if (!properties.enabled()
        || (event.to() != DeploymentStatus.LIVE && event.to() != DeploymentStatus.FAILED)) {
      return;
    }
    ProjectSnapshot project = projects.get(event.projectId());
    users
        .findById(project.ownerId())
        .ifPresent(owner -> deliver(compose(event, project, owner.email())));
  }

  Notification compose(DeploymentStatusChanged event, ProjectSnapshot project, String email) {
    String link = properties.dashboardUrl() + "/deployments/" + event.deploymentId();
    if (event.to() == DeploymentStatus.LIVE) {
      return new Notification(
          email,
          "✅ " + project.name() + " is live",
          "Your deployment of "
              + project.name()
              + " is live at "
              + appUrls.urlFor(project.slug())
              + "\n\nDetails: "
              + link);
    }
    return new Notification(
        email,
        "❌ Deployment of " + project.name() + " failed",
        "Reason: "
            + event.failureReason()
            + "\nYour previous version (if any) is still serving traffic."
            + "\n\nThe Forge agent is analysing the logs. See its diagnosis at: "
            + link);
  }

  private void deliver(Notification notification) {
    for (NotificationChannel channel : channels) {
      try {
        channel.send(notification);
      } catch (RuntimeException e) {
        log.warn("Notification via {} failed: {}", channel.name(), e.getMessage());
      }
    }
  }
}
