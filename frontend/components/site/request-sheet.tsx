"use client";

import { ArrowUpRight, Send, X } from "lucide-react";
import { useEffect, useState } from "react";

import { studioDevConfig } from "@/lib/config";
import type { WalletConnection, WriteProgress } from "@/lib/types";

type FormValues = {
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

const emptyValues: FormValues = { requestId: "", resourceId: "", purpose: "", dataCategory: "", recipient: "", requestExpiresAt: "", retentionUntil: "", sharingMode: "NONE", commercialUse: false, replayNonce: "" };

export function RequestSheet({ open, onOpenChange, wallet, wrongNetwork, progress, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; wallet: WalletConnection | null; wrongNetwork: boolean; progress: WriteProgress | null; onSubmit: (args: (string | boolean)[]) => Promise<void> }) {
  const [values, setValues] = useState(emptyValues);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") onOpenChange(false); }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onOpenChange]);

  function update(key: keyof FormValues, value: string | boolean) { setValues((current) => ({ ...current, [key]: value })); }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const required = [values.requestId, values.resourceId, values.purpose, values.dataCategory, values.recipient, values.requestExpiresAt, values.retentionUntil, values.replayNonce];
    if (required.some((value) => !String(value).trim())) { setError("Complete every required field before simulation."); return; }
    setSubmitting(true);
    try {
      await onSubmit([values.requestId, studioDevConfig.policyId, values.resourceId, values.purpose, values.dataCategory, values.recipient, values.requestExpiresAt, values.retentionUntil, values.sharingMode, values.commercialUse, values.replayNonce]);
      setValues(emptyValues);
      onOpenChange(false);
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : String(submitError)); } finally { setSubmitting(false); }
  }

  if (!open) return null;
  return <div className="site-dialog-backdrop" role="presentation" onMouseDown={() => onOpenChange(false)}><div className="site-dialog-content" role="dialog" aria-modal="true" aria-labelledby="request-sheet-title" onMouseDown={(event) => event.stopPropagation()}><button type="button" className="site-dialog-close" aria-label="Close request form" onClick={() => onOpenChange(false)}><X className="size-5" /></button><div><p className="site-kicker">/REQUEST USE</p><h2 id="request-sheet-title">Describe the use.</h2><p className="site-dialog-description">State who is asking, what data they need, why, and who receives it. Simulation runs before any wallet prompt.</p></div><form onSubmit={submit} className="site-request-form"><div className="site-form-note"><span>CONSENT POLICY</span><strong>{studioDevConfig.policyId}</strong><span className="site-form-wallet">{wallet ? wrongNetwork ? "Wrong network" : "Wallet ready" : "Wallet required"}</span></div><div className="site-form-grid"><Field label="WHAT DATA? / Resource ID" value={values.resourceId} placeholder="profile-..." onChange={(value) => update("resourceId", value)} /><Field label="WHY? / Purpose" value={values.purpose} placeholder="account access verification" onChange={(value) => update("purpose", value)} /><Field label="WHO RECEIVES IT? / Recipient" value={values.recipient} placeholder="ConsentGate Demo App" onChange={(value) => update("recipient", value)} /><Field label="Data category" value={values.dataCategory} placeholder="identity profile" onChange={(value) => update("dataCategory", value)} /><Field label="Request expiry UTC" value={values.requestExpiresAt} placeholder="2026-09-20T15:22:29Z" onChange={(value) => update("requestExpiresAt", value)} /><Field label="Retention until UTC" value={values.retentionUntil} placeholder="2026-09-20T03:22:29Z" onChange={(value) => update("retentionUntil", value)} /><Field label="Request ID" value={values.requestId} placeholder="request-2026-..." onChange={(value) => update("requestId", value)} /><Field label="Replay nonce" value={values.replayNonce} placeholder="unique nonce" onChange={(value) => update("replayNonce", value)} /><label className="site-checkbox"><input type="checkbox" checked={values.commercialUse} onChange={(event) => update("commercialUse", event.target.checked)} /> Commercial use</label></div>{error ? <p className="site-form-error">{error}</p> : null}<div className="site-dialog-footer"><button type="button" className="editorial-button editorial-button-outline" onClick={() => onOpenChange(false)}>Cancel</button><button type="submit" disabled={!wallet || wrongNetwork || submitting || progress?.phase === "consensus" || progress?.phase === "confirming-state"} className="editorial-button editorial-button-dark"><Send className="size-4" />{submitting ? "Preparing…" : "Simulate & create permission record"}<ArrowUpRight className="size-4" /></button></div></form></div></div>;
}

function Field({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) { return <label className="site-form-field"><span>{label}</span><input required value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>; }
