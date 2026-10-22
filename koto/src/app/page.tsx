import { Logo } from "@/components/Logo";
import { SearchBox } from "@/components/SearchBox";
import { ActionButtons } from "@/components/ActionButtons";
import { BottomNav } from "@/components/BottomNav";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex justify-center pt-14 pb-2">
        <Logo size="lg" />
      </header>

      <main className="flex flex-1 flex-col items-center px-6">
        <p className="mt-2 mb-10 text-foreground-secondary text-center">
          Understand Japanese naturally.
        </p>

        <div className="w-full max-w-md space-y-4">
          <SearchBox autoFocus />
          <ActionButtons />
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
