import { ArrowUpRight } from "lucide-react";

import type { RemoteEvidenceCheck } from "@/lib/types";

const outcomes = [
  ["AUTHORIZED", "All policy dimensions pass and the evidence is sufficient."],
  ["DENIED", "The requested use conflicts with a registered boundary."],
  ["REPAIR REQUIRED", "Evidence must be repaired before a decision can be trusted."],
  ["RETRY REQUIRED", "Consensus could not reach a stable result this round."],
] as const;

export function DecisionSection({ reviewReady, remoteCheck, onReview }: { reviewReady: boolean; remoteCheck: RemoteEvidenceCheck | undefined; onReview: () => void }) {
  return (
    <section id="decision" className="decision-section">
      <div className="decision-inner">
        <div className="decision-heading"><span className="section-index">05</span><h2>Consensus decides.</h2><p>ConsentGate does not infer authorization from a local interface. The network evaluates the frozen request and evidence.</p></div>
        <div className="decision-list">{outcomes.map(([label, description]) => <div key={label} className="decision-row"><span>{label}</span><small>{description}</small></div>)}</div>
        <div className="decision-footer"><div><span className="decision-current-dot" />AWAITING REVIEW <strong>{remoteCheck?.status === "verified" ? "Evidence source verified." : "Evidence source unavailable."}</strong></div><button type="button" disabled={!reviewReady} onClick={onReview} className="dark-editorial-button">{reviewReady ? "Run review" : "Review unavailable"}<ArrowUpRight className="size-4" /></button></div>
      </div>
    </section>
  );
}
