"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { api, ApiError, errorMessage } from "@/lib/api";

/** Optional public demo account, shown on the login page (baked in at build time). */
const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_EMAIL ?? "";
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "";
const HAS_DEMO = DEMO_EMAIL !== "" && DEMO_PASSWORD !== "";

/** Only follow same-origin, path-only redirects. */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/projects";
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { status, login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [demoSubmitting, setDemoSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (status === "authenticated") router.replace(next);
  }, [status, next, router]);

  const isRegister = mode === "register";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (isRegister && password.length < 10) {
      setFieldErrors({ password: "Use at least 10 characters." });
      return;
    }
    setSubmitting(true);
    try {
      if (isRegister) await api.auth.register({ email, password, displayName });
      await login(email, password);
      router.replace(next);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0) {
        setFieldErrors(err.fieldErrors);
      }
      setError(
        err instanceof ApiError && err.status === 401 ? "Incorrect email or password." : errorMessage(err),
      );
      setSubmitting(false);
    }
  }

  async function signInAsDemo() {
    setError(null);
    setDemoSubmitting(true);
    try {
      await login(DEMO_EMAIL, DEMO_PASSWORD);
      router.replace(next);
    } catch (err) {
      setError(errorMessage(err));
      setDemoSubmitting(false);
    }
  }

  return (
    <Card className="bg-zinc-900/70 p-6 shadow-2xl shadow-black/40 backdrop-blur">
      <h1 className="text-lg font-semibold tracking-tight text-zinc-50">
        {isRegister ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mt-1 text-[13px] text-zinc-500">
        {isRegister ? "Deploy your first app in a couple of minutes." : "Sign in to your Forge dashboard."}
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}

        {isRegister && (
          <Field label="Name" htmlFor="displayName" error={fieldErrors.displayName}>
            <Input
              id="displayName"
              autoComplete="name"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              invalid={!!fieldErrors.displayName}
              placeholder="Ada Lovelace"
            />
          </Field>
        )}
        <Field label="Email" htmlFor="email" error={fieldErrors.email}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            autoFocus={!isRegister}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            invalid={!!fieldErrors.email}
            placeholder="you@example.com"
          />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          error={fieldErrors.password}
          hint={isRegister ? "At least 10 characters." : undefined}
        >
          <Input
            id="password"
            type="password"
            autoComplete={isRegister ? "new-password" : "current-password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            invalid={!!fieldErrors.password}
          />
        </Field>

        <Button type="submit" variant="primary" className="w-full" loading={submitting}>
          {isRegister ? "Create account" : "Sign in"}
        </Button>
      </form>

      {!isRegister && HAS_DEMO && (
        <div className="mt-5">
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-zinc-600">
            <span className="h-px flex-1 bg-white/[0.06]" />
            or
            <span className="h-px flex-1 bg-white/[0.06]" />
          </div>
          <Button type="button" className="mt-5 w-full" onClick={signInAsDemo} loading={demoSubmitting}>
            Try the demo account
          </Button>
          <p className="mt-2.5 text-center font-mono text-[11px] text-zinc-500">
            {DEMO_EMAIL} · {DEMO_PASSWORD}
          </p>
        </div>
      )}

      <p className="mt-6 text-center text-[13px] text-zinc-500">
        {isRegister ? "Already have an account? " : "New to Forge? "}
        <Link
          href={isRegister ? "/login" : "/register"}
          className="font-medium text-violet-400 hover:text-violet-300 focus-visible:underline focus-visible:outline-none"
        >
          {isRegister ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </Card>
  );
}
