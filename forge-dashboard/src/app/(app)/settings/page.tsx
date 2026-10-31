"use client";

import { CheckCircle2, Unplug, UserRound } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { GithubIcon } from "@/components/ui/GithubIcon";
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
      <CardHeader
        icon={<GithubIcon className="size-4" />}
        title="GitHub"
        description="Pick repositories from your account, deploy private repos and auto-deploy on push."
      />
      <div className="p-5">
        {connection.error && !c ? (
          <Alert action={<Button size="sm" onClick={connection.reload}>Retry</Button>}>{connection.error.message}</Alert>
        ) : !c ? (
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-9 w-36" />
          </div>
        ) : c.connected ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30">
                <CheckCircle2 className="size-4" aria-hidden />
              </span>
              <div>
                <p className="text-[13px] font-medium text-zinc-100">
                  Connected as <span className="font-mono">@{c.login}</span>
                </p>
                <p className="text-xs text-zinc-500">Forge can list your repositories and branches.</p>
              </div>
            </div>
            <Button variant="secondary" onClick={() => setConfirmDisconnect(true)} icon={<Unplug className="size-4" aria-hidden />}>
              Disconnect
            </Button>
          </div>
        ) : !c.oauthConfigured ? (
          <p
            className="max-w-md text-[13px] text-zinc-400"
            title="Set FORGE_GITHUB_CLIENT_ID and FORGE_GITHUB_CLIENT_SECRET on forge-server to enable it."
          >
            GitHub sign-in isn&apos;t enabled on this server. Public repositories work without it: enter them as
            owner/name when you create a project.
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-md text-[13px] text-zinc-400">
              Not connected. Public repositories work without it; connect to browse your repos and deploy private ones.
            </p>
            <Button variant="primary" onClick={connect} loading={connecting} icon={<GithubIcon className="size-4" />}>
              Connect GitHub
            </Button>
          </div>
        )}
      </div>

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
      <CardHeader icon={<UserRound className="size-4" aria-hidden />} title="Account" />
      <dl className="grid gap-4 p-5 text-[13px] sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">Name</dt>
          <dd className="mt-0.5 text-zinc-100">{user?.displayName}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Email</dt>
          <dd className="mt-0.5 text-zinc-100">{user?.email}</dd>
        </div>
      </dl>
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" description="Your account and connected services." />
      <div className="space-y-6">
        <GithubCard />
        <AccountCard />
      </div>
    </div>
  );
}
