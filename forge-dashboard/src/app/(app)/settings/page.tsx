"use client";

import { Unplug } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardFooter } from "@/components/ui/Card";
import { GithubIcon } from "@/components/ui/GithubIcon";
import { Field, Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
import { useQuery } from "@/lib/hooks";

/** Shows a toast for `?github=connected|error` (set by the OAuth callback) and strips the param. */
function GithubCallbackToast({ onConnected }: { onConnected: () => void }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const handled = useRef(false);
  const result = params.get("github");

  useEffect(() => {
    if (!result || handled.current) return;
    handled.current = true;
    if (result === "connected") {
      toast.success("GitHub connected", "Your repositories are now available when creating a project.");
      onConnected();
    } else {
      toast.error("GitHub connection failed", "GitHub didn't authorise Forge. Please try again.");
    }
    router.replace(pathname, { scroll: false });
  }, [result, toast, router, pathname, onConnected]);

  return null;
}

function GithubCard() {
  const toast = useToast();
  const connection = useQuery("github-connection", () => api.github.connection());
  const [connecting, setConnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const c = connection.data;

  async function connect() {
    setConnecting(true);
    try {
      const { authorizeUrl } = await api.github.connect();
      window.location.href = authorizeUrl;
    } catch (err) {
      toast.error("Couldn't start the GitHub connection", errorMessage(err));
      setConnecting(false);
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    try {
      await api.github.disconnect();
      toast.success("GitHub disconnected");
      setConfirmDisconnect(false);
      connection.reload();
    } catch (err) {
      toast.error("Couldn't disconnect GitHub", errorMessage(err));
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <Card>
      <Suspense>
        <GithubCallbackToast onConnected={connection.reload} />
      </Suspense>
      <div className="p-6">
        <h2 className="text-heading-20 text-gray-1000">GitHub</h2>
        <p className="mt-3 max-w-xl text-copy-14 text-gray-900">
          Pick repositories from your account, deploy private repos and auto-deploy on push.
        </p>
        <div className="mt-5">
          {connection.error && !c ? (
            <Alert action={<Button size="sm" onClick={connection.reload}>Retry</Button>}>{connection.error.message}</Alert>
          ) : !c ? (
            <Skeleton className="h-14 w-full" />
          ) : c.connected ? (
            <div className="flex items-center gap-3 rounded-md border border-gray-alpha-400 px-4 py-3">
              <GithubIcon className="size-5 shrink-0 text-gray-1000" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-label-14 font-medium text-gray-1000">
                  <span className="font-mono">@{c.login}</span>
                </p>
                <p className="text-label-13 text-gray-900">Forge can list your repositories and branches.</p>
              </div>
              <Badge tone="green" size="sm">
                Connected
              </Badge>
            </div>
          ) : !c.oauthConfigured ? (
            <p
              className="rounded-md border border-gray-alpha-400 bg-background-200 px-4 py-3 text-copy-14 text-gray-900"
              title="Set FORGE_GITHUB_CLIENT_ID and FORGE_GITHUB_CLIENT_SECRET on forge-server to enable it."
            >
              GitHub sign-in isn&apos;t enabled on this server. Public repositories work without it: enter them as
              owner/name when you create a project.
            </p>
          ) : (
            <p className="rounded-md border border-gray-alpha-400 bg-background-200 px-4 py-3 text-copy-14 text-gray-900">
              Not connected. Public repositories work without it; connect to browse your repos and deploy private ones.
            </p>
          )}
        </div>
      </div>
      <CardFooter>
        <span>
          {c?.connected ? "Disconnecting keeps existing projects working for public repos." : "Forge requests read access to your repositories."}
        </span>
        {c?.connected ? (
          <Button variant="secondary" size="sm" onClick={() => setConfirmDisconnect(true)} icon={<Unplug className="size-4" aria-hidden />}>
            Disconnect
          </Button>
        ) : c?.oauthConfigured ? (
          <Button variant="primary" size="sm" onClick={connect} loading={connecting} icon={<GithubIcon className="size-4" />}>
            Connect GitHub
          </Button>
        ) : null}
      </CardFooter>

      <ConfirmDialog
        open={confirmDisconnect}
        onClose={() => setConfirmDisconnect(false)}
        onConfirm={disconnect}
        loading={disconnecting}
        danger
        title="Disconnect GitHub?"
        description="Existing projects keep working for public repos. Private repos and the repo picker stop working until you reconnect."
        confirmLabel="Disconnect"
      />
    </Card>
  );
}

function AccountCard() {
  const { user } = useAuth();
  return (
    <Card>
      <div className="p-6">
        <h2 className="text-heading-20 text-gray-1000">Account</h2>
        <p className="mt-3 text-copy-14 text-gray-900">The name and email address on your Forge account.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="account-name">
            <Input id="account-name" value={user?.displayName ?? ""} readOnly />
          </Field>
          <Field label="Email" htmlFor="account-email">
            <Input id="account-email" type="email" value={user?.email ?? ""} readOnly />
          </Field>
        </div>
      </div>
      <CardFooter>
        <span>These details are read-only for now.</span>
      </CardFooter>
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Settings" description="Your account and connected services." />
      <div className="space-y-6">
        <GithubCard />
        <AccountCard />
      </div>
    </div>
  );
}
