"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SearchBox } from "@/components/SearchBox";
import { DirectionSelector } from "@/components/DirectionSelector";
import { TranslateResult } from "@/components/TranslateResult";
import { BottomNav } from "@/components/BottomNav";
import type { Direction, TranslationResult } from "@/lib/translate";

type Status = "idle" | "loading" | "error" | "done";

export function TranslateClient() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";

  const [direction, setDirection] = useState<Direction>("auto");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialQuery) return;
    runTranslation(initialQuery, direction);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  async function runTranslation(text: string, dir: Direction) {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, direction: dir }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Translation failed.");
      setResult(data);
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Translation failed.");
      setStatus("error");
    }
  }

  function handleDirectionChange(d: Direction) {
    setDirection(d);
    if (initialQuery) runTranslation(initialQuery, d);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-6 pt-8 pb-4">
        <Link href="/">
          <Logo size="sm" />
        </Link>
      </header>

      <main className="flex-1 px-6 pb-10">
        <div className="mx-auto w-full max-w-md space-y-4">
          <SearchBox initialValue={initialQuery} />
          <DirectionSelector value={direction} onChange={handleDirectionChange} />

          {status === "idle" && (
            <p className="pt-10 text-center text-foreground-secondary">
              Type something above to translate it.
            </p>
          )}

          {status === "loading" && (
            <div className="animate-pulse space-y-4 pt-2">
              <div className="h-32 rounded-koto bg-border" />
              <div className="h-20 rounded-koto bg-border" />
            </div>
          )}

          {status === "error" && (
            <p className="pt-10 text-center text-vermillion">{error}</p>
          )}

          {status === "done" && result && <TranslateResult result={result} />}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
