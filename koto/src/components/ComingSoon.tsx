import Link from "next/link";
import { Logo } from "@/components/Logo";
import { BottomNav } from "@/components/BottomNav";

export function ComingSoon({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center px-6 pt-8 pb-4">
        <Link href="/">
          <Logo size="sm" />
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-semibold text-foreground mb-2">{title}</h1>
        <p className="max-w-xs text-foreground-secondary">{description}</p>
        <p className="mt-6 rounded-full border border-border px-3.5 py-1 text-xs font-medium text-foreground-secondary">
          {phase}
        </p>
      </main>

      <BottomNav />
    </div>
  );
}
