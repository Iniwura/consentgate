import { ShieldCheck } from "lucide-react";

import { SectionHeading } from "@/components/consentgate/section-heading";
import { StatusPill } from "@/components/consentgate/status-pill";
import { formatUtc, humanizeDimension, shortAddress, shortHash } from "@/lib/format";
import type { PolicyRecord } from "@/lib/types";

export function PolicyPanel({ policy }: { policy: PolicyRecord }) {
  return (
    <section id="policy" className="terminal-card scroll-mt-6 p-5 sm:p-6">
      <SectionHeading
        eyebrow="02 / registered policy"
        title="Policy guardrails"
        detail={`${policy.rules.length} dimensions persisted in the contract schema`}
        action={<StatusPill label={policy.state} tone={policy.revoked || policy.expired ? "danger" : "success"} />}
      />
      <div className="grid gap-5 md:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-xl border border-stone-800 bg-[#171615] p-4">
          <div className="mb-4 flex items-center gap-2 text-stone-300">
            <ShieldCheck className="size-4 text-emerald-300" />
            <span className="font-mono text-[10px] uppercase tracking-[0.15em]">Policy identity</span>
          </div>
          <dl className="space-y-3 text-xs">
            <div><dt className="text-stone-600">Policy</dt><dd className="mt-1 break-all font-mono text-stone-200">{policy.policy_id}</dd></div>
            <div><dt className="text-stone-600">Owner</dt><dd className="mt-1 font-mono text-stone-200">{shortAddress(policy.owner)}</dd></div>
            <div><dt className="text-stone-600">Resource</dt><dd className="mt-1 font-mono text-stone-200">{policy.resource_id}</dd></div>
            <div><dt className="text-stone-600">Version</dt><dd className="mt-1 font-mono text-stone-200">{policy.policy_version}</dd></div>
            <div><dt className="text-stone-600">Expires</dt><dd className="mt-1 font-mono text-stone-200">{formatUtc(policy.expires_at_utc)}</dd></div>
            <div><dt className="text-stone-600">Fingerprint</dt><dd className="mt-1 break-all font-mono text-[10px] leading-4 text-stone-300">{shortHash(policy.policy_fingerprint, 16, 12)}</dd></div>
          </dl>
        </div>
        <div>
          <div className="mb-2 grid grid-cols-[auto_1fr_auto] gap-3 px-3 font-mono text-[9px] uppercase tracking-[0.12em] text-stone-600">
            <span>#</span><span>Dimension</span><span>Rule ID</span>
          </div>
          <div className="divide-y divide-stone-800/80 overflow-hidden rounded-xl border border-stone-800">
            {policy.rules.map((rule, index) => (
              <div key={rule.rule_id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 bg-[#1a1817] px-3 py-3 text-xs">
                <span className="font-mono text-[10px] text-stone-600">{String(index + 1).padStart(2, "0")}</span>
                <div className="min-w-0">
                  <p className="font-mono text-[11px] text-stone-200">{humanizeDimension(rule.dimension)}</p>
                  <p className="mt-1 text-[10px] leading-4 text-stone-500">{rule.description}</p>
                </div>
                <span className="font-mono text-[10px] text-amber-200/70">{rule.rule_id}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-stone-500">
            <span>{policy.allowed_authorities.length} authority allowlisted</span>
            {policy.allowed_authorities.map((authority) => (
              <span key={authority.authority_id} className="font-mono text-stone-400">{authority.authority_id} / {authority.authority_key_id}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
