import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-calcadao flex min-h-dvh flex-col items-center px-4 py-8">
      <Link href="/" className="mb-8" aria-label="BoraTreinar — início">
        <Logo size={40} />
      </Link>
      <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-lg sm:p-8">
        {children}
      </div>
    </main>
  );
}
