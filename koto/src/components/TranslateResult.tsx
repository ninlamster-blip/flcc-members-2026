"use client";

import { motion } from "framer-motion";
import type { TranslationResult } from "@/lib/translate";

function speak(text: string, lang: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  window.speechSynthesis.speak(utterance);
}

function SpeakButton({ text, lang }: { text: string; lang: string }) {
  return (
    <button
      type="button"
      onClick={() => speak(text, lang)}
      aria-label="Listen"
      className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full border border-border text-foreground-secondary hover:text-indigo hover:border-indigo/40 transition-colors"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 9v6h4l5 4V5L9 9H5Z" />
        <path d="M16.5 8.5a5 5 0 0 1 0 7" />
      </svg>
    </button>
  );
}

export function TranslateResult({ result }: { result: TranslationResult }) {
  const isTargetJapanese = /[぀-ヿ一-龯]/.test(result.translation);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="space-y-4"
    >
      <div className="rounded-koto border border-border p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-foreground-secondary mb-3">
          {result.detectedSourceLang} → {result.detectedTargetLang}
        </p>

        <div className="flex items-start gap-3">
          <p className="flex-1 font-jp text-3xl leading-snug text-foreground">
            {result.translation}
          </p>
          <SpeakButton
            text={result.translation}
            lang={isTargetJapanese ? "ja-JP" : "en-US"}
          />
        </div>

        {result.romaji && (
          <p className="mt-2 text-foreground-secondary">{result.romaji}</p>
        )}

        <div className="mt-5 pt-5 border-t border-border">
          <p className="text-sm text-foreground-secondary">{result.original}</p>
        </div>
      </div>

      <div className="rounded-koto border border-border p-6">
        <h3 className="text-sm font-semibold text-indigo mb-2">
          What does this really mean?
        </h3>
        <p className="text-foreground leading-relaxed">{result.meaning}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <RegisterCard label="Formal" text={result.formal} />
        <RegisterCard label="Casual" text={result.casual} />
        <RegisterCard label="Business" text={result.business} />
      </div>
    </motion.div>
  );
}

function RegisterCard({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-koto border border-border p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-vermillion mb-1.5">
        {label}
      </p>
      <p className="font-jp text-foreground">{text}</p>
    </div>
  );
}
