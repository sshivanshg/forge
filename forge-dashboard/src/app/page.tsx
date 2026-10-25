"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { LogoMark } from "@/components/ui/Logo";

export default function Home() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
    else if (status === "authenticated" || status === "unreachable") router.replace("/projects");
  }, [status, router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <LogoMark className="size-9 animate-pulse" />
    </main>
  );
}
