import { ExternalLink, FileCheck2, Link2, ShieldAlert } from "lucide-react";

import { CopyButton } from "@/components/consentgate/copy-button";
import { SectionHeading } from "@/components/consentgate/section-heading";
import { StatusPill } from "@/components/consentgate/status-pill";
import { formatUtc, shortHash } from "@/lib/format";
import type { EvidenceSetRecord, RemoteEvidenceCheck } from "@/lib/types";

export function EvidencePanel({
  evidenceSet,
  remoteCheck,
}: {
  evidenceSet: EvidenceSetRecord | null;
  remoteCheck: RemoteEvidenceCheck | undefined;
}) {
  if (!evidenceSet) {
    return (
      <section className="terminal-card p-5 sm:p-6">
        <SectionHeading eyebrow="03 / evidence set" title="Evidence not frozen" detail="The live request has not assigned an evidence set." />
        <div className="rounded-xl border border-dashed border-stone-700 p-6 text-sm text-stone-500">No evidence rows are available from the contract yet.</div>
      </section>
    );
  }

  return (
    <section id="evidence" className="terminal-card scroll-mt-6 p-5 sm:p-6">
      <SectionHeading
        eyebrow="03 / frozen evidence"
        title="Evidence manifest"
        detail={`Set ${evidenceSet.evidence_set_id} · version ${evidenceSet.evidence_version}`}
        action={
          <StatusPill
            label={remoteCheck?.status === "verified" ? "REMOTE VERIFIED" : remoteCheck?.status === "mismatch" ? "HASH MISMATCH" : "REVIEW LOCKED"}
            tone={remoteCheck?.status === "verified" ? "success" : remoteCheck?.status === "mismatch" ? "danger" : "warning"}
          />
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="metric-cell"><span>Evidence type</span><strong>Consent record</strong></div>
        <div className="metric-cell"><span>Authority</span><strong>{evidenceSet.manifest.entries[0]?.authority_id || "—"}</strong></div>
        <div className="metric-cell"><span>Version</span><strong>{evidenceSet.evidence_version}</strong></div>
      </div>
      <div className="space-y-3">
        {evidenceSet.manifest.entries.map((entry) => {
          const check = remoteCheck?.entries.find((item) => item.evidenceId === entry.evidence_id);
          return (
            <article key={`${entry.evidence_id}-${entry.version}`} className="rounded-xl border border-stone-800 bg-[#171615] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300"><FileCheck2 className="size-4" /></div>
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-stone-100">{entry.evidence_id}</p>
                    <p className="mt-1 text-[11px] text-stone-500">{entry.evidence_kind} · {entry.authority_id} · {entry.version}</p>
                  </div>
                </div>
                <StatusPill label={check?.sourceStatus === "verified" && check.attestationStatus === "verified" ? "HASH OK" : check?.sourceStatus === "mismatch" || check?.attestationStatus === "mismatch" ? "MISMATCH" : "UNVERIFIED"} tone={check?.sourceStatus === "verified" && check.attestationStatus === "verified" ? "success" : check?.sourceStatus === "mismatch" || check?.attestationStatus === "mismatch" ? "danger" : "warning"} compact />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-stone-600">
                <span>issued {formatUtc(entry.issued_at_utc)}</span><span>expires {formatUtc(entry.expires_at_utc)}</span><span>{entry.required ? "required" : "optional"}</span>
              </div>
              <details className="mt-4 border-t border-stone-800 pt-3 text-[10px]">
                <summary className="cursor-pointer select-none font-mono uppercase tracking-[0.12em] text-stone-500 transition hover:text-stone-300">Show hash and source details</summary>
                <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
                  <HashRow label="Content SHA-256" value={entry.content_sha256} />
                  <HashRow label="Attestation hash" value={entry.attestation_hash} />
                  <UrlRow label="Source URL" url={entry.source_url} />
                  <UrlRow label="Attestation URL" url={entry.attestation_url} />
                </div>
              </details>
            </article>
          );
        })}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <VerificationState label="On-chain commitment" value="Verified" tone="success" detail={shortHash(evidenceSet.evidence_set_fingerprint, 12, 10)} />
        <VerificationState label="Remote document" value={remoteCheck?.status === "verified" ? "Verified" : remoteCheck?.status === "mismatch" ? "Hash mismatch" : remoteCheck ? "Unavailable" : "Checking"} tone={remoteCheck?.status === "verified" ? "success" : remoteCheck?.status === "mismatch" ? "danger" : "warning"} detail={remoteCheck?.checkedAt ? `checked ${formatUtc(remoteCheck.checkedAt)}` : "public URL reachability required"} />
      </div>
      {remoteCheck?.status !== "verified" ? (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/15 bg-amber-300/5 p-3 text-[11px] leading-5 text-amber-100/75">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-200" />
          <p>{remoteCheck?.status === "mismatch" ? "Remote evidence was reachable but did not match the frozen hashes. Review remains disabled." : "Remote evidence is not publicly reachable yet. Review remains intentionally disabled."}</p>
        </div>
      ) : null}
    </section>
  );
}

function HashRow({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="mb-1 text-stone-600">{label}</p><div className="flex min-w-0 items-center gap-1 font-mono text-stone-300"><span className="truncate">{shortHash(value, 16, 10)}</span><CopyButton value={value} /></div></div>;
}

function UrlRow({ label, url }: { label: string; url: string }) {
  return <div className="min-w-0"><p className="mb-1 text-stone-600">{label}</p><a className="flex min-w-0 items-center gap-1 truncate text-amber-200/80 transition hover:text-amber-100" href={url} target="_blank" rel="noreferrer"><Link2 className="size-3 shrink-0" /><span className="truncate">{url.replace("https://raw.githubusercontent.com/", "raw/")}</span><ExternalLink className="size-3 shrink-0" /></a></div>;
}

function VerificationState({ label, value, tone, detail }: { label: string; value: string; tone: "success" | "warning" | "danger"; detail: string }) {
  const valueClass = tone === "success" ? "text-emerald-200" : tone === "danger" ? "text-red-200" : "text-amber-200";
  return <div className="rounded-xl border border-stone-800 bg-[#171615] p-4"><p className="font-mono text-[9px] uppercase tracking-[0.13em] text-stone-600">{label}</p><p className={`mt-2 text-sm font-medium ${valueClass}`}>{value}</p><p className="mt-1 break-all font-mono text-[10px] text-stone-600">{detail}</p></div>;
}
