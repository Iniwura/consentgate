import { ArrowDownRight, Fingerprint, LockKeyhole } from "lucide-react";

import { shortHash } from "@/lib/format";
import type { LiveSnapshot } from "@/lib/types";

export function Hero({ snapshot, loading }: { snapshot: LiveSnapshot | undefined; loading: boolean }) {
  const request = snapshot?.request;
  const evidenceFrozen = request?.effective_state === "USE_REQUEST_FROZEN";

  return (
    <section id="top" className="site-hero site-section">
      <div className="site-meta-row">
        <span>©2026</span>
        <span>/GENLAYER INTELLIGENT CONTRACT</span>
        <span>STUDIO DEV / 61997</span>
      </div>
      <div className="hero-heading-wrap">
        <p className="site-kicker">Authorization before access</p>
        <h1 className="hero-heading"><span>DATA</span><span className="hero-heading-indent">AUTHORIZATION</span></h1>
      </div>
      <div className="hero-stage" aria-label="Live authorization state">
        <div className="hero-stage-panel hero-stage-request">
          <div className="hero-stage-label"><span>01 / REQUEST</span><ArrowDownRight className="size-4" /></div>
          <div className="hero-stage-content">
            <p className="hero-stage-big">{request?.purpose || "Account access verification"}</p>
            <div className="hero-stage-line"><span>DATA</span><strong>{request?.data_category ? request.data_category.replaceAll("_", " ") : loading ? "Reading…" : "Identity profile"}</strong></div>
            <div className="hero-stage-line"><span>TO</span><strong>{request?.recipient || "ConsentGate Demo App"}</strong></div>
          </div>
        </div>
        <div className="hero-stage-center"><Fingerprint className="size-8" /><span>CG / LIVE CASE</span></div>
        <div className="hero-stage-panel hero-stage-state">
          <div className="hero-stage-label"><span>02 / STATE</span><LockKeyhole className="size-4" /></div>
          <div className="hero-stage-content">
            <p className={`hero-stage-big ${evidenceFrozen ? "hero-stage-verified" : ""}`}>{evidenceFrozen ? "EVIDENCE FROZEN" : request?.effective_state || "READING"}</p>
            <div className="hero-stage-line"><span>REQUEST</span><strong>{request?.request_id || "cghappy…"}</strong></div>
            <div className="hero-stage-line"><span>FINGERPRINT</span><strong>{shortHash(request?.request_fingerprint || "", 8, 5)}</strong></div>
          </div>
        </div>
      </div>
      <div className="hero-foot-row">
        <span>Policy → request → evidence → consensus</span>
        <a href="#intro" className="hero-scroll-link">Scroll to inspect <ArrowDownRight className="size-4" /></a>
      </div>
    </section>
  );
}
