"use client";

import { ChevronDown, Copy, Fingerprint } from "lucide-react";
import { useState } from "react";

import { CopyButton } from "@/components/consentgate/copy-button";
import { formatUtc, humanizeDimension, shortAddress, shortHash } from "@/lib/format";
import type { LiveSnapshot } from "@/lib/types";

export function LiveAuthorization({ snapshot, loading }: { snapshot: LiveSnapshot | undefined; loading: boolean }) {
  const [open, setOpen] = useState(false);
  const request = snapshot?.request;
  const policy = snapshot?.policy;
  const isFrozen = request?.effective_state === "USE_REQUEST_FROZEN";

  return (
    <section id="live-case" className="site-section live-case-section">
      <div className="section-title-row"><div className="intro-label"><span className="section-index">03</span><span>Live Authorization</span></div><span className="section-aside">The current case, read from Studio Dev</span></div>
      <div className="live-case-visual">
        <div className="live-case-art">
          <div className="case-art-top"><span>CONSENTGATE / CASE 001</span><span>READ ONLY</span></div>
          <div className="case-art-center"><span className="case-art-index">/01</span><h2>ACCOUNT<br /><em>ACCESS</em><br />VERIFICATION</h2></div>
          <div className="case-art-bottom"><span>REQUESTED USE</span><strong>{request?.purpose || (loading ? "Reading live case…" : "Account access verification")}</strong></div>
        </div>
        <div className="live-case-meta">
          <div className="case-meta-status"><span className="site-live-dot" />{isFrozen ? "EVIDENCE FROZEN" : request?.effective_state || "READING"}</div>
          <div className="case-meta-block"><span>DATA</span><strong>{request?.data_category ? humanizeDimension(request.data_category) : "Identity profile"}</strong></div>
          <div className="case-meta-block"><span>RECIPIENT</span><strong>{request?.recipient || "ConsentGate Demo App"}</strong></div>
          <div className="case-meta-block"><span>SHARING</span><strong>{request?.sharing_mode === "NONE" ? "None" : request?.sharing_mode || "—"}</strong></div>
          <div className="case-meta-block"><span>COMMERCIAL USE</span><strong>{request?.commercial_use ? "Yes" : "No"}</strong></div>
          <div className="case-meta-block"><span>REQUEST</span><strong className="mono-small">{request?.request_id || "cghappy…"}</strong><CopyButton value={request?.request_id || ""} /></div>
          <button type="button" className="editorial-button" onClick={() => setOpen((value) => !value)}>{open ? "Close live dossier" : "Open live dossier"}<ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} /></button>
        </div>
      </div>
      {open ? (
        <div className="live-dossier">
          <div className="live-dossier-header"><span>Live dossier</span><span>Current state / {request?.effective_state || "—"}</span></div>
          <div className="live-dossier-grid">
            <DossierField label="Purpose" value={request?.purpose} />
            <DossierField label="Data category" value={request?.data_category ? humanizeDimension(request.data_category) : undefined} />
            <DossierField label="Retention" value={formatUtc(request?.retention_until_utc)} />
            <DossierField label="Requester" value={request?.requester ? shortAddress(request.requester) : undefined} />
            <DossierField label="Policy" value={policy?.policy_id} copy={policy?.policy_id} />
            <DossierField label="Request ID" value={request?.request_id} copy={request?.request_id} />
            <DossierField label="Policy fingerprint" value={shortHash(policy?.policy_fingerprint || "", 12, 8)} />
            <DossierField label="Request fingerprint" value={shortHash(request?.request_fingerprint || "", 12, 8)} />
          </div>
          <div className="live-dossier-footer"><Fingerprint className="size-4" /><span>Bound to {policy?.rules.length || 9} policy dimensions · resource {request?.resource_id || "—"}</span><Copy className="ml-auto size-4 text-stone-500" /></div>
        </div>
      ) : null}
    </section>
  );
}

function DossierField({ label, value, copy }: { label: string; value: string | undefined; copy?: string }) {
  return <div className="dossier-field"><span>{label}</span><strong>{value || "—"}</strong>{copy ? <CopyButton value={copy} /> : null}</div>;
}
