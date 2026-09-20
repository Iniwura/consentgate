import { ArrowRight, Fingerprint, KeyRound } from "lucide-react";

import { CopyButton } from "@/components/consentgate/copy-button";
import { SectionHeading } from "@/components/consentgate/section-heading";
import { StatusPill } from "@/components/consentgate/status-pill";
import { formatUtc, humanizeDimension, shortAddress, shortHash } from "@/lib/format";
import type { PolicyRecord, UseRequestRecord } from "@/lib/types";

function DataField({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  return (
    <div className="min-w-0 border-b border-stone-800/80 pb-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-stone-600">{label}</p>
      <div className="mt-1 flex items-center gap-1">
        <p className="min-w-0 truncate font-mono text-xs text-stone-200" title={value}>{value}</p>
        {copy && value ? <CopyButton value={value} /> : null}
      </div>
    </div>
  );
}

export function Dossier({
  policy,
  request,
}: {
  policy: PolicyRecord;
  request: UseRequestRecord;
}) {
  const state = request.effective_state || request.state;
  return (
    <section id="dossier" className="terminal-card scroll-mt-6 p-5 sm:p-6">
      <SectionHeading
        eyebrow="01 / live authorization dossier"
        title="Request dossier"
        detail="Read from the configured Studio Dev contract; no local fixture values are substituted."
        action={<StatusPill label={state === "USE_REQUEST_FROZEN" ? "EVIDENCE FROZEN" : state || "READING"} tone={state === "USE_REQUEST_FROZEN" ? "success" : "neutral"} />}
      />
      <div className="mb-5 rounded-xl border border-amber-200/15 bg-amber-200/[0.04] p-4 sm:p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-200/65">Authorization request</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-lg font-medium tracking-tight text-stone-100 sm:text-xl">
          <span>{request.data_category ? humanizeDimension(request.data_category) : "Identity profile"}</span>
          <ArrowRight className="size-4 text-stone-600" />
          <span>{request.recipient || "Recipient not specified"}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-mono uppercase tracking-[0.1em]">
          <span className="rounded-md border border-stone-700 bg-stone-900/30 px-2 py-1 text-stone-400">{request.sharing_mode === "NONE" ? "No sharing" : request.sharing_mode}</span>
          <span className={`rounded-md border px-2 py-1 ${request.commercial_use ? "border-red-300/25 bg-red-300/5 text-red-200" : "border-emerald-300/20 bg-emerald-300/5 text-emerald-200"}`}>{request.commercial_use ? "Commercial use" : "No commercial use"}</span>
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
          <DataField label="Request ID" value={request.request_id} copy />
          <DataField label="Policy ID" value={request.policy_id} copy />
          <DataField label="Requester" value={shortAddress(request.requester)} copy={Boolean(request.requester)} />
          <DataField label="Resource" value={request.resource_id} />
          <DataField label="Purpose" value={request.purpose} />
          <DataField label="Data category" value={request.data_category} />
          <DataField label="Recipient" value={request.recipient} />
          <DataField label="Sharing" value={request.sharing_mode} />
        </div>
        <div className="rounded-xl border border-stone-800 bg-[#171615] p-4">
          <div className="mb-4 flex items-center gap-2 text-stone-300">
            <KeyRound className="size-4 text-amber-200/75" />
            <span className="font-mono text-[10px] uppercase tracking-[0.15em]">Bound validity</span>
          </div>
          <dl className="space-y-3 text-xs">
            <div className="flex justify-between gap-4 border-b border-stone-800 pb-2">
              <dt className="text-stone-500">Request expires</dt>
              <dd className="font-mono text-stone-200">{formatUtc(request.request_expires_at_utc)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-stone-800 pb-2">
              <dt className="text-stone-500">Retention until</dt>
              <dd className="font-mono text-stone-200">{formatUtc(request.retention_until_utc)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-stone-800 pb-2">
              <dt className="text-stone-500">Commercial use</dt>
              <dd className={request.commercial_use ? "font-mono text-red-300" : "font-mono text-emerald-300"}>
                {String(request.commercial_use)}
              </dd>
            </div>
            <div>
              <dt className="mb-1 flex items-center gap-1 text-stone-500"><Fingerprint className="size-3" />Request fingerprint</dt>
              <dd className="break-all font-mono text-[10px] leading-4 text-stone-300">{request.request_fingerprint || "—"}</dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2 border-t border-stone-800/80 pt-4 font-mono text-[10px] text-stone-500">
        <span>policy fp {shortHash(policy.policy_fingerprint)}</span>
        <span className="text-stone-700">/</span>
        <span>evidence set {request.evidence_set_id || "not assigned"}</span>
        <span className="text-stone-700">/</span>
        <span>{request.review_attempts} review attempt{request.review_attempts === 1 ? "" : "s"}</span>
      </div>
    </section>
  );
}
