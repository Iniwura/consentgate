"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      aria-label={`Copy ${value}`}
      onClick={copy}
      className="rounded-md p-1 text-stone-500 transition hover:bg-stone-700/40 hover:text-stone-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200"
    >
      {copied ? <Check className="size-3.5 text-emerald-300" /> : <Copy className="size-3.5" />}
    </button>
  );
}
