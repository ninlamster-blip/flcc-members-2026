import { Suspense } from "react";
import { TranslateClient } from "@/components/TranslateClient";

export default function TranslatePage() {
  return (
    <Suspense fallback={null}>
      <TranslateClient />
    </Suspense>
  );
}
