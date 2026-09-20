"use client";

import { CircleAlert, ExternalLink, WalletCards } from "lucide-react";

import { CopyButton } from "@/components/consentgate/copy-button";
import { StatusPill } from "@/components/consentgate/status-pill";
import { shortAddress } from "@/lib/format";
import type { WalletConnection } from "@/lib/types";

export function WalletBar({
  wallet,
  isConnecting,
  error,
  onConnect,
  onSwitchNetwork,
}: {
  wallet: WalletConnection | null;
  isConnecting: boolean;
  error: string | null;
  onConnect: () => void;
  onSwitchNetwork: () => void;
}) {
  const isRightNetwork = wallet?.chainId === 61997;
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {wallet ? (
        <>
          <StatusPill label={isRightNetwork ? "STUDIO DEV" : `CHAIN ${wallet.chainId ?? "?"}`} tone={isRightNetwork ? "success" : "danger"} compact />
          <div className="flex items-center gap-1 rounded-full border border-stone-700 bg-stone-800/40 px-2.5 py-1.5 font-mono text-[10px] text-stone-300">
            <WalletCards className="size-3 text-amber-200/70" />{shortAddress(wallet.address)}<CopyButton value={wallet.address} />
          </div>
          {!isRightNetwork ? <button type="button" onClick={onSwitchNetwork} className="terminal-button terminal-button-danger">Switch network</button> : null}
        </>
      ) : (
        <button type="button" onClick={onConnect} disabled={isConnecting} className="terminal-button terminal-button-primary">
          <WalletCards className="size-3.5" /> {isConnecting ? "Connecting…" : "Connect wallet"}
        </button>
      )}
      {error ? <span title={error} className="inline-flex items-center gap-1 text-[10px] text-red-300"><CircleAlert className="size-3" /> wallet error</span> : null}
      <a href="https://genlayer-explorer.vercel.app" target="_blank" rel="noreferrer" className="hidden items-center gap-1 text-[10px] text-stone-600 transition hover:text-stone-300 sm:flex"><ExternalLink className="size-3" /> Explorer</a>
    </div>
  );
}
