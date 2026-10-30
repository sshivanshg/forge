package com.forge.project.domain;

import com.forge.shared.error.ValidationException;
import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Value object: the project's unique, URL-safe name. It becomes a DNS label ({@code
 * <slug>.localhost}), so it must follow DNS rules: lowercase letters, digits and hyphens, at most
 * 63 characters, and no hyphen at either end.
 */
public record Slug(String value) {

  private static final Pattern VALID = Pattern.compile("^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$");
  private static final int MAX_GENERATED = 40;

  public Slug {
    if (value == null || !VALID.matcher(value).matches()) {
      throw new ValidationException(
          "slug must be lowercase letters, digits and hyphens (max 63, no leading/trailing"
              + " hyphen)");
    }
  }

  /** Derives a slug from a display name: "My Cool API!" → "my-cool-api". */
  public static Slug fromName(String name) {
    String ascii = Normalizer.normalize(name, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    String slug =
        ascii.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-+|-+$)", "");
    if (slug.length() > MAX_GENERATED) {
      slug = slug.substring(0, MAX_GENERATED).replaceAll("-+$", "");
    }
    return new Slug(slug.isEmpty() ? "app" : slug);
  }

  public Slug withSuffix(String suffix) {
    return new Slug(value + "-" + suffix);
  }
}
