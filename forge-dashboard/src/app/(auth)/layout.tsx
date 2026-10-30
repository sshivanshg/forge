import { Logo } from "@/components/ui/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-backdrop flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <Logo className="scale-110" />
      </div>
      <div className="w-full max-w-sm">{children}</div>
      <p className="mt-10 text-center text-xs text-zinc-600">Push code. Get a live URL. Let the agent explain what broke.</p>
    </main>
  );
}
