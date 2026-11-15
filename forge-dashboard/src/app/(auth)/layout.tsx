import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col bg-background-100">
      <header className="flex h-16 items-center px-4 sm:px-6">
        <Link href="/" className="rounded-md focus-ring" aria-label="Forge home">
          <Logo />
        </Link>
      </header>
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
      <footer className="border-t border-gray-alpha-400 px-4 py-6 text-center text-label-13 text-gray-900 sm:px-6">
        Push code. Get a live URL. Let the agent explain what broke.
      </footer>
    </main>
  );
}
