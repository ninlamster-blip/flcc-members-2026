"use client";

import clsx from "clsx";
import type { Direction } from "@/lib/translate";

const OPTIONS: { value: Direction; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "en-ja", label: "EN → JA" },
  { value: "ja-en", label: "JA → EN" },
  { value: "fil-ja", label: "FIL → JA" },
  { value: "ja-fil", label: "JA → FIL" },
];

export function DirectionSelector({
  value,
  onChange,
}: {
  value: Direction;
  onChange: (d: Direction) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={clsx(
            "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
            value === opt.value
              ? "border-indigo bg-indigo text-white"
              : "border-border text-foreground-secondary hover:border-indigo/40 hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
