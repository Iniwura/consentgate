import {
  Check,
  CircleAlert,
  FileCheck2,
  Fingerprint,
  LockKeyhole,
  ShieldCheck,
  Wifi,
} from "lucide-react";

import { StatusPill, type StatusTone } from "@/components/consentgate/status-pill";

type LifecycleStep = {
  label: string;
  target: string;
  value: string;
  detail: string;
  tone: StatusTone;
  icon: typeof Check;
};

export function LifecycleRail({
  policyReady,
  requestState,
  evidenceReady,
  remoteState,
  reviewReady,
}: {
  policyReady: boolean;
  requestState: string;
  evidenceReady: boolean;
  remoteState: "verified" | "unavailable" | "mismatch" | "idle";
  reviewReady: boolean;
}) {
  const remoteTone: StatusTone =
    remoteState === "verified"
      ? "success"
      : remoteState === "mismatch"
        ? "danger"
        : remoteState === "unavailable"
          ? "warning"
          : "neutral";
  const steps: LifecycleStep[] = [
    {
      label: "Policy",
      target: "#policy",
      value: policyReady ? "REGISTERED" : "READING",
      detail: "policy + nine rule dimensions",
      tone: policyReady ? "success" : "loading",
      icon: ShieldCheck,
    },
    {
      label: "Request",
      target: "#dossier",
      value: requestState || "NOT READ",
      detail: "request fingerprint anchored",
      tone: requestState ? "success" : "neutral",
      icon: Fingerprint,
    },
    {
      label: "Evidence",
      target: "#evidence",
      value: evidenceReady ? "FROZEN" : "NOT FROZEN",
      detail: "manifest + evidence-set fingerprint",
      tone: evidenceReady ? "success" : "neutral",
      icon: FileCheck2,
    },
    {
      label: "Remote fetch",
      target: "#evidence",
      value:
        remoteState === "verified"
          ? "HASH VERIFIED"
          : remoteState === "mismatch"
            ? "HASH MISMATCH"
            : remoteState === "unavailable"
              ? "UNAVAILABLE"
              : "NOT CHECKED",
      detail: "raw bytes must match manifest",
      tone: remoteTone,
      icon: Wifi,
    },
    {
      label: "Review",
      target: "#review",
      value: reviewReady ? "READY" : "LOCKED",
      detail: reviewReady ? "wallet action available" : "remote evidence required",
      tone: reviewReady ? "success" : "warning",
      icon: LockKeyhole,
    },
  ];

  return (
    <aside className="rounded-2xl border border-stone-700/70 bg-[#1b1918] p-4 shadow-[0_16px_50px_rgb(0_0_0/18%)] lg:sticky lg:top-6 lg:h-fit">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-stone-500">Protocol rail</p>
          <p className="mt-1 text-sm font-medium text-stone-200">Authorization lifecycle</p>
        </div>
        <CircleAlert className="size-4 text-stone-600" />
      </div>
      <div className="relative space-y-1">
        <div className="absolute bottom-7 left-[15px] top-7 w-px bg-stone-700" />
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <a key={step.label} href={step.target} className="relative flex gap-3 rounded-lg py-3 transition hover:bg-stone-800/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200">
              <div className="z-10 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-stone-700 bg-[#1b1918]">
                <Icon className="size-3.5 text-stone-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-stone-200">{step.label}</p>
                  <StatusPill label={step.value} tone={step.tone} compact />
                </div>
                <p className="mt-1 text-[11px] leading-4 text-stone-500">{step.detail}</p>
              </div>
            </a>
          );
        })}
      </div>
      <div className="mt-4 rounded-xl border border-red-300/15 bg-red-300/5 p-3 text-[11px] leading-5 text-stone-400">
        <span className="font-mono uppercase tracking-[0.12em] text-red-300/80">Safety gate</span>
        <p className="mt-1">Review stays unavailable until every required remote byte is fetched and hash-verified.</p>
      </div>
    </aside>
  );
}
