import { ChevronDown } from "lucide-react";

import { humanizeDimension } from "@/lib/format";
import type { PolicyRecord } from "@/lib/types";

export function PolicySection({ policy }: { policy: PolicyRecord | undefined }) {
  return (
    <section id="policy" className="site-section policy-section">
      <div className="section-title-row"><div className="intro-label"><span className="section-index">06</span><span>Policy</span></div><span className="section-aside">Nine rules define whether this use can proceed</span></div>
      <div className="policy-lead"><h2>One request.<br /><em>Nine boundaries.</em></h2><p>{policy?.policy_text || "The registered policy is read live from the ConsentGate contract."}</p></div>
      <div className="policy-list">{(policy?.rules || []).map((rule, index) => <details key={rule.rule_id} className="policy-row"><summary><span>{String(index + 1).padStart(2, "0")}</span><strong>{humanizeDimension(rule.dimension)}</strong><small>{rule.rule_id}</small><ChevronDown className="size-4" /></summary><p>{rule.description}</p></details>)}</div>
      {!policy ? <div className="empty-editorial">Reading the nine policy dimensions…</div> : null}
    </section>
  );
}
