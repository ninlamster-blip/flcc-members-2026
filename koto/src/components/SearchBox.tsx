"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";

export function SearchBox({
  autoFocus = false,
  initialValue = "",
}: {
  autoFocus?: boolean;
  initialValue?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = value.trim();
    if (!text) return;
    router.push(`/translate?q=${encodeURIComponent(text)}`);
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full"
    >
      <div className="flex items-center gap-3 rounded-koto border border-border bg-background px-5 py-4 shadow-sm transition-shadow focus-within:shadow-md focus-within:border-indigo/40">
        <svg
          aria-hidden
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          className="text-foreground-secondary shrink-0"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Translate anything…"
          className="w-full bg-transparent text-lg text-foreground placeholder:text-foreground-secondary outline-none"
        />
      </div>
    </motion.form>
  );
}
