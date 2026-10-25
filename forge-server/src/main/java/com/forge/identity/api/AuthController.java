package com.forge.identity.api;

import com.forge.identity.UserLookup;
import com.forge.identity.UserLookup.UserSummary;
import com.forge.identity.application.AuthService;
import com.forge.identity.application.TokenPair;
import com.forge.shared.error.NotFoundException;
import com.forge.shared.security.AuthenticatedUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** HTTP layer only: validate input, call one service method, map the result. */
@RestController
@RequestMapping("/api/v1")
class AuthController {

  private final AuthService authService;
  private final UserLookup userLookup;

  AuthController(AuthService authService, UserLookup userLookup) {
    this.authService = authService;
    this.userLookup = userLookup;
  }

  @PostMapping("/auth/register")
  @ResponseStatus(HttpStatus.CREATED)
  UserSummary register(@Valid @RequestBody RegisterRequest request) {
    return authService.register(request.email(), request.password(), request.displayName());
  }

  @PostMapping("/auth/login")
  TokenPair login(@Valid @RequestBody LoginRequest request) {
    return authService.login(request.email(), request.password());
  }

  @PostMapping("/auth/refresh")
  TokenPair refresh(@Valid @RequestBody RefreshRequest request) {
    return authService.refresh(request.refreshToken());
  }

  @PostMapping("/auth/logout")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void logout(@Valid @RequestBody RefreshRequest request) {
    authService.logout(request.refreshToken());
  }

  @GetMapping("/me")
  UserSummary me(@AuthenticationPrincipal AuthenticatedUser user) {
    return userLookup
        .findById(user.id())
        .orElseThrow(() -> new NotFoundException("User", user.id()));
  }

  record RegisterRequest(
      @NotBlank @Email @Size(max = 320) String email,
      @NotBlank @Size(min = 10, max = 100, message = "must be 10 to 100 characters")
          String password,
      @NotBlank @Size(max = 100) String displayName) {}

  record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}

  record RefreshRequest(@NotBlank String refreshToken) {}
}
