"use client";

import { ArrowUpRight, Check, ChevronDown, ExternalLink, ShieldAlert } from "lucide-react";
import { useState } from "react";

import { CopyButton } from "@/components/consentgate/copy-button";
import { formatUtc, shortHash } from "@/lib/format";
import type { EvidenceSetRecord, RemoteEvidenceCheck } from "@/lib/types";

export function EvidenceSection({ evidenceSet, remoteCheck }: { evidenceSet: EvidenceSetRecord | null | undefined; remoteCheck: RemoteEvidenceCheck | undefined }) {
  const [details, setDetails] = useState(false);
  const entry = evidenceSet?.manifest.entries[0];
  const remoteVerified = remoteCheck?.status === "verified";
  const remoteMismatch = remoteCheck?.status === "mismatch";

  return (
    <section id="evidence" className="site-section evidence-section">
      <div className="section-title-row"><div className="intro-label"><span className="section-index">04</span><span>Evidence</span></div><span className="section-aside">What the authorization is relying on</span></div>
      <div className="evidence-lead"><h2>Consent is only as strong as the bytes behind it.</h2><p>A frozen evidence set binds this request to a consent record and an attestation. The commitment is on-chain; the public source is checked separately.</p></div>
      {entry ? (
        <div className="evidence-record">
          <div className="evidence-record-main">
            <div className="evidence-record-label"><span>CONSENT RECORD</span><span>{entry.evidence_id}</span></div>
            <h3>{entry.evidence_kind.replaceAll("-", " ")}</h3>
            <div className="evidence-facts">
              <EvidenceFact label="Authority" value={entry.authority_id} />
              <EvidenceFact label="Version" value={entry.version} />
              <EvidenceFact label="Issued" value={formatUtc(entry.issued_at_utc)} />
              <EvidenceFact label="Expires" value={formatUtc(entry.expires_at_utc)} />
            </div>
          </div>
          <div className="evidence-states">
            <div className="evidence-state-row"><span>ONCHAIN COMMITMENT</span><strong className="state-verified"><Check className="size-4" />VERIFIED</strong></div>
            <div className="evidence-state-row"><span>REMOTE SOURCE</span><strong className={remoteVerified ? "state-verified" : remoteMismatch ? "state-failed" : "state-blocked"}>{remoteVerified ? "VERIFIED" : remoteMismatch ? "HASH MISMATCH" : remoteCheck ? "UNAVAILABLE" : "CHECKING"}</strong></div>
            <p className="evidence-state-note">{remoteVerified ? "The remote bytes match the frozen commitment." : remoteMismatch ? "The remote bytes do not match the committed hashes." : "Review cannot begin until the frozen bytes are publicly reachable and match their committed hashes."}</p>
          </div>
        </div>
      ) : (
        <div className="empty-editorial">No evidence set is assigned to the live request.</div>
      )}
      {entry ? (
        <div className="evidence-details-wrap">
          <button type="button" className="text-link" onClick={() => setDetails((value) => !value)}>{details ? "Hide protocol details" : "View protocol details"}<ChevronDown className={`size-4 transition-transform ${details ? "rotate-180" : ""}`} /></button>
          {details ? <div className="evidence-detail-grid"><HashDetail label="Content SHA-256" value={entry.content_sha256} /><HashDetail label="Attestation hash" value={entry.attestation_hash} /><UrlDetail label="Source URL" value={entry.source_url} /><UrlDetail label="Attestation URL" value={entry.attestation_url} /><HashDetail label="Evidence-set fingerprint" value={evidenceSet?.evidence_set_fingerprint || ""} /></div> : null}
        </div>
      ) : null}
      {!remoteVerified ? <div className="evidence-unavailable"><ShieldAlert className="size-4" /><span>REMOTE EVIDENCE <strong>— NOT YET PUBLISHED</strong></span><ArrowUpRight className="ml-auto size-4" /></div> : null}
    </section>
  );
}

function EvidenceFact({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function HashDetail({ label, value }: { label: string; value: string }) { return <div className="evidence-detail"><span>{label}</span><div><strong>{shortHash(value, 16, 10)}</strong><CopyButton value={value} /></div></div>; }
function UrlDetail({ label, value }: { label: string; value: string }) { return <div className="evidence-detail"><span>{label}</span><a href={value} target="_blank" rel="noreferrer"><strong>{value.replace("https://raw.githubusercontent.com/", "raw/")}</strong><ExternalLink className="size-3" /></a></div>; }
