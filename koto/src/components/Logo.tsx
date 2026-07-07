export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const textSize = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl",
  }[size];

  return (
    <div className="flex items-center gap-2 select-none">
      <span
        aria-hidden
        className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo text-white font-jp text-base font-bold"
      >
        言
      </span>
      <span className={`${textSize} font-semibold tracking-tight text-foreground`}>
        KOTO
      </span>
    </div>
  );
}
