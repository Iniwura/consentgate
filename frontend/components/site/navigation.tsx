"use client";

import { ArrowUpRight, WalletCards } from "lucide-react";

import { CopyButton } from "@/components/consentgate/copy-button";
import { shortAddress } from "@/lib/format";
import type { WalletConnection } from "@/lib/types";

export function Navigation({
  wallet,
  connecting,
  onConnect,
  onSwitchNetwork,
}: {
  wallet: WalletConnection | null;
  connecting: boolean;
  onConnect: () => void;
  onSwitchNetwork: () => void;
}) {
  const rightNetwork = wallet?.chainId === 61997;

  return (
    <nav className="site-nav" aria-label="Primary navigation">
      <a href="#top" className="site-wordmark">ConsentGate<span>.</span></a>
      <div className="site-nav-links">
        <a href="#protocol">Protocol</a>
        <a href="#live-case">Live Case</a>
        <a href="#evidence">Evidence</a>
        <a href="#contract">Contract</a>
      </div>
      <div className="site-nav-wallet">
        {wallet && !rightNetwork ? (
          <button type="button" onClick={onSwitchNetwork} className="site-nav-action site-nav-action-warn">Switch to Studio Dev</button>
        ) : wallet ? (
          <span className="site-wallet-address"><span className="site-live-dot" />{shortAddress(wallet.address)}<CopyButton value={wallet.address} /></span>
        ) : null}
        <button type="button" onClick={onConnect} disabled={connecting} className="site-nav-action">
          <WalletCards className="size-3.5" />{wallet ? "Wallet connected" : connecting ? "Connecting…" : "Connect wallet"}
        </button>
      </div>
      <a href="#request-access" className="site-mobile-arrow" aria-label="Request access"><ArrowUpRight className="size-4" /></a>
    </nav>
  );
}
