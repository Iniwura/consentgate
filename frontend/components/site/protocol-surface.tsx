"use client";

import { ArrowUpRight } from "lucide-react";
import { useState } from "react";

import { CopyButton } from "@/components/consentgate/copy-button";
import { contractMethods } from "@/lib/contract";
import { studioDevConfig } from "@/lib/config";

const featured = ["register_policy", "create_use_request", "freeze_use_request", "review_use", "issue_capability", "consume_capability"];

export function ProtocolSurface() {
  const [expanded, setExpanded] = useState(false);
  const all = Object.keys(contractMethods);
  const methods = expanded ? all : featured;
  return (
    <section id="contract" className="site-section contract-section">
      <div className="section-title-row"><div className="intro-label"><span className="section-index">07</span><span>Protocol Surface</span></div><span className="section-aside">ConsentGate on Studio Dev</span></div>
      <div className="contract-intro"><h2>Small surface.<br /><em>Strong guarantees.</em></h2><div><p>17 public methods govern the path from policy to capability.</p><div className="contract-counts"><span><strong>13</strong> writes</span><span><strong>4</strong> views</span></div></div></div>
      <div className="contract-method-list">{methods.map((method) => <div key={method} className="contract-method"><span className="method-mark">/</span><strong>{method}</strong><ArrowUpRight className="size-4" /></div>)}</div>
      <button type="button" className="text-link contract-expand" onClick={() => setExpanded((value) => !value)}>{expanded ? "Show featured methods" : "View all 17 methods"}<ArrowUpRight className="size-4" /></button>
      <div className="contract-footer"><div><span>ADDRESS</span><strong>{studioDevConfig.contractAddress}</strong><CopyButton value={studioDevConfig.contractAddress} /></div><div><span>NETWORK</span><strong>Studio Dev / {studioDevConfig.chainId}</strong></div></div>
    </section>
  );
}
