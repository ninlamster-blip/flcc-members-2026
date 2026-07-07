"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const ACTIONS = [
  { href: "/translate", label: "Translate", icon: TranslateIcon },
  { href: "/conversation", label: "Conversation", icon: ConversationIcon },
  { href: "/learn", label: "Learn", icon: LearnIcon },
];

export function ActionButtons() {
  return (
    <div className="grid grid-cols-3 gap-3 w-full">
      {ACTIONS.map(({ href, label, icon: Icon }, i) => (
        <motion.div
          key={href}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 * (i + 1), ease: "easeOut" }}
        >
          <Link
            href={href}
            className="group flex flex-col items-center justify-center gap-2 rounded-koto border border-border bg-background px-4 py-6 text-center transition-colors hover:border-indigo/30 hover:bg-indigo/[0.03] active:scale-[0.98]"
          >
            <Icon />
            <span className="text-sm font-medium text-foreground">{label}</span>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

function TranslateIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-indigo">
      <path d="M4 5h9M8 3v2m2.5 2c-.7 2.6-2.4 4.7-4.9 6.2M6 7c1 2.7 3 4.8 6 6.3M13 21l4-9 4 9M14.5 18h5" />
    </svg>
  );
}

function ConversationIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-vermillion">
      <path d="M4 6h11a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9l-4 3v-3H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />
      <path d="M13 18h2l4 3v-3h1a1 1 0 0 0 1-1v-4" />
    </svg>
  );
}

function LearnIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-success">
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H12v16H6.5A2.5 2.5 0 0 1 4 17.5Z" />
      <path d="M20 6.5A2.5 2.5 0 0 0 17.5 4H12v16h5.5a2.5 2.5 0 0 0 2.5-2.5Z" />
    </svg>
  );
}
