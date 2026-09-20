import { CircleAlert, CircleCheck, CircleDot, LoaderCircle } from "lucide-react";

type StatusTone = "success" | "warning" | "danger" | "neutral" | "loading";

const toneStyles: Record<StatusTone, string> = {
  success: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  warning: "border-amber-300/25 bg-amber-300/10 text-amber-200",
  danger: "border-red-400/25 bg-red-400/10 text-red-300",
  neutral: "border-stone-500/30 bg-stone-500/10 text-stone-300",
  loading: "border-sky-300/25 bg-sky-300/10 text-sky-200",
};

export function StatusPill({
  label,
  tone = "neutral",
  compact = false,
}: {
  label: string;
  tone?: StatusTone;
  compact?: boolean;
}) {
  const Icon =
    tone === "success"
      ? CircleCheck
      : tone === "danger"
        ? CircleAlert
        : tone === "loading"
          ? LoaderCircle
          : tone === "warning"
            ? CircleAlert
            : CircleDot;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-mono uppercase tracking-[0.11em] ${toneStyles[tone]} ${compact ? "px-2 py-1 text-[9px]" : "px-2.5 py-1.5 text-[10px]"}`}
    >
      <Icon className={`size-3 ${tone === "loading" ? "animate-spin" : ""}`} />
      {label}
    </span>
  );
}

export type { StatusTone };

