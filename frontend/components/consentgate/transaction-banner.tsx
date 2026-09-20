import { CheckCircle2, CircleAlert, LoaderCircle, X } from "lucide-react";

import type { WriteProgress } from "@/lib/types";

export function TransactionBanner({
  progress,
  onDismiss,
}: {
  progress: WriteProgress;
  onDismiss: () => void;
}) {
  const isFailure = progress.phase === "failed";
  const isComplete = progress.phase === "complete";
  return (
    <div className={`fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-2xl items-start gap-3 rounded-xl border p-4 shadow-2xl backdrop-blur ${isFailure ? "border-red-300/25 bg-[#2a1918]" : isComplete ? "border-emerald-300/25 bg-[#17241d]" : "border-amber-200/25 bg-[#252019]"}`}>
      {isFailure ? <CircleAlert className="mt-0.5 size-4 shrink-0 text-red-300" /> : isComplete ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" /> : <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin text-amber-200" />}
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs text-stone-100">{progress.label}</p>
        {progress.txHash ? <p className="mt-1 break-all font-mono text-[10px] text-stone-500">{progress.txHash}</p> : null}
        {progress.error ? <p className="mt-1 text-[11px] text-red-200/80">{progress.error}</p> : null}
      </div>
      <button type="button" aria-label="Dismiss transaction status" onClick={onDismiss} className="text-stone-500 hover:text-stone-200"><X className="size-4" /></button>
    </div>
  );
}

