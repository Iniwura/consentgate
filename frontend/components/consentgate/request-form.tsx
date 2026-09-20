"use client";

import { Plus, Send } from "lucide-react";
import { useState } from "react";

import { SectionHeading } from "@/components/consentgate/section-heading";
import { StatusPill } from "@/components/consentgate/status-pill";
import type { WalletConnection, WriteProgress } from "@/lib/types";

type RequestFormValues = {
  requestId: string;
  resourceId: string;
  purpose: string;
  dataCategory: string;
  recipient: string;
  requestExpiresAt: string;
  retentionUntil: string;
  sharingMode: string;
  commercialUse: boolean;
  replayNonce: string;
};

const emptyForm: RequestFormValues = {
  requestId: "",
  resourceId: "",
  purpose: "",
  dataCategory: "",
  recipient: "",
  requestExpiresAt: "",
  retentionUntil: "",
  sharingMode: "NONE",
  commercialUse: false,
  replayNonce: "",
};

export function RequestForm({
  policyId,
  wallet,
  wrongNetwork,
  progress,
  onSubmit,
}: {
  policyId: string;
  wallet: WalletConnection | null;
  wrongNetwork: boolean;
  progress: WriteProgress | null;
  onSubmit: (args: (string | boolean)[]) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function update(field: keyof RequestFormValues, value: string | boolean) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const required = [values.requestId, values.resourceId, values.purpose, values.dataCategory, values.recipient, values.requestExpiresAt, values.retentionUntil, values.replayNonce];
    if (required.some((value) => !value.trim())) {
      setError("Every request field is required before simulation.");
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit([
        values.requestId,
        policyId,
        values.resourceId,
        values.purpose,
        values.dataCategory,
        values.recipient,
        values.requestExpiresAt,
        values.retentionUntil,
        values.sharingMode,
        values.commercialUse,
        values.replayNonce,
      ]);
      setValues(emptyForm);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section id="request-form" className="terminal-card scroll-mt-6 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <SectionHeading eyebrow="05 / wallet-gated action" title="New authorization request" detail="No transaction is sent until you submit this form, approve simulation, and approve the wallet prompt." />
        <button type="button" onClick={() => setOpen((current) => !current)} className="terminal-button terminal-button-secondary shrink-0"><Plus className="size-3.5" /> {open ? "Close" : "Open"}</button>
      </div>
      {open ? (
        <form onSubmit={submit} className="border-t border-stone-800 pt-5">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-[10px] text-stone-500"><StatusPill label={wallet ? (wrongNetwork ? "WRONG NETWORK" : "WALLET READY") : "WALLET REQUIRED"} tone={wallet && !wrongNetwork ? "success" : "warning"} compact /><span>Bound to policy <span className="font-mono text-stone-300">{policyId}</span></span></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Request ID" value={values.requestId} onChange={(value) => update("requestId", value)} placeholder="request-2026-..." required />
            <Field label="Resource ID" value={values.resourceId} onChange={(value) => update("resourceId", value)} placeholder="profile-..." required />
            <Field label="Replay nonce" value={values.replayNonce} onChange={(value) => update("replayNonce", value)} placeholder="unique nonce" required />
            <Field label="Purpose" value={values.purpose} onChange={(value) => update("purpose", value)} placeholder="account access verification" required />
            <Field label="Data category" value={values.dataCategory} onChange={(value) => update("dataCategory", value)} placeholder="identity profile" required />
            <Field label="Recipient" value={values.recipient} onChange={(value) => update("recipient", value)} placeholder="ConsentGate Demo App" required />
            <Field label="Request expiry UTC" value={values.requestExpiresAt} onChange={(value) => update("requestExpiresAt", value)} placeholder="2026-09-20T15:22:29Z" required />
            <Field label="Retention until UTC" value={values.retentionUntil} onChange={(value) => update("retentionUntil", value)} placeholder="2026-09-20T03:22:29Z" required />
            <label className="flex items-center gap-3 self-end rounded-lg border border-stone-800 bg-[#171615] px-3 py-2.5 text-xs text-stone-300"><input type="checkbox" checked={values.commercialUse} onChange={(event) => update("commercialUse", event.target.checked)} className="accent-amber-200" /> Commercial use</label>
          </div>
          {error ? <p className="mt-4 text-xs text-red-300">{error}</p> : null}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="submit" disabled={!wallet || wrongNetwork || isSubmitting || progress?.phase === "finalizing"} className="terminal-button terminal-button-primary disabled:cursor-not-allowed disabled:opacity-40"><Send className="size-3.5" /> {isSubmitting ? "Preparing…" : "Simulate & create request"}</button>
            <p className="text-[10px] text-stone-600">Simulation runs before the paid GenLayer write.</p>
          </div>
        </form>
      ) : null}
    </section>
  );
}

function Field({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; required?: boolean }) {
  return <label className="block"><span className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.12em] text-stone-600">{label}</span><input required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="terminal-input" /></label>;
}
