"use client";

import { useCallback, useEffect, useState } from "react";

import { TransactionBanner } from "@/components/consentgate/transaction-banner";
import { studioDevConfig } from "@/lib/config";
import { connectWallet, getBrowserProvider, getLiveSnapshot, readWalletConnection, submitWrite, switchToStudioDev, WriteTransactionError } from "@/lib/contract";
import { verifyRemoteEvidence } from "@/lib/evidence";
import type { LiveSnapshot, WalletConnection, WriteProgress } from "@/lib/types";
import { DecisionSection } from "@/components/site/decision";
import { EvidenceSection } from "@/components/site/evidence";
import { FinalCta } from "@/components/site/final-cta";
import { Hero } from "@/components/site/hero";
import { Intro } from "@/components/site/intro";
import { LiveAuthorization } from "@/components/site/live-authorization";
import { Navigation } from "@/components/site/navigation";
import { PolicySection } from "@/components/site/policy";
import { Protocol } from "@/components/site/protocol";
import { ProtocolSurface } from "@/components/site/protocol-surface";
import { RequestSheet } from "@/components/site/request-sheet";
import { SiteFooter } from "@/components/site/footer";
import { StatementMarquee } from "@/components/site/statement-marquee";

let liveReadInFlight: Promise<LiveSnapshot> | null = null;
let latestEvidenceSet: LiveSnapshot["evidenceSet"] = null;

function readLiveOnce() {
  if (!liveReadInFlight) {
    liveReadInFlight = getLiveSnapshot().finally(() => { liveReadInFlight = null; });
  }
  return liveReadInFlight;
}

export function LiveSite() {
  const [snapshot, setSnapshot] = useState<LiveSnapshot>();
  const [readState, setReadState] = useState<"loading" | "ready" | "error">("loading");
  const [readError, setReadError] = useState<Error | null>(null);
  const [remoteCheck, setRemoteCheck] = useState<Awaited<ReturnType<typeof verifyRemoteEvidence>>>();
  const [remoteChecking, setRemoteChecking] = useState(false);
  const [wallet, setWallet] = useState<WalletConnection | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [progress, setProgress] = useState<WriteProgress | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setReadState((state) => state === "ready" ? "ready" : "loading");
    try {
      const nextSnapshot = await readLiveOnce();
      latestEvidenceSet = nextSnapshot.evidenceSet;
      setSnapshot(nextSnapshot);
      setReadError(null);
      setReadState("ready");
    } catch (error) {
      setReadError(error instanceof Error ? error : new Error(String(error)));
      setReadState("error");
    }
  }, []);

  useEffect(() => {
    const kickoff = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => { window.clearTimeout(kickoff); window.clearInterval(timer); };
  }, [refresh]);

  const evidenceId = snapshot?.evidenceSet?.evidence_set_id;
  useEffect(() => {
    const evidenceSet = latestEvidenceSet;
    if (!evidenceId || !evidenceSet) return;
    let cancelled = false;
    const kickoff = window.setTimeout(() => {
      setRemoteChecking(true);
      void verifyRemoteEvidence(evidenceSet)
        .then((result) => { if (!cancelled) setRemoteCheck(result); })
        .catch(() => { if (!cancelled) setRemoteCheck(undefined); })
        .finally(() => { if (!cancelled) setRemoteChecking(false); });
    }, 0);
    return () => { cancelled = true; window.clearTimeout(kickoff); };
  }, [evidenceId]);

  useEffect(() => {
    const provider = getBrowserProvider();
    if (!provider) return;
    void readWalletConnection(provider).then(setWallet).catch(() => setWallet(null));
  }, []);

  const wrongNetwork = Boolean(wallet && wallet.chainId !== studioDevConfig.chainId);
  const reviewReady = Boolean(snapshot?.request.effective_state === "USE_REQUEST_FROZEN" && remoteCheck?.status === "verified" && wallet && !wrongNetwork);

  async function handleConnect() {
    setWalletError(null); setConnecting(true);
    try { setWallet(await connectWallet()); } catch (error) { setWalletError(error instanceof Error ? error.message : String(error)); } finally { setConnecting(false); }
  }
  async function handleSwitchNetwork() {
    if (!wallet) return;
    setWalletError(null);
    try { await switchToStudioDev(wallet.provider); setWallet(await readWalletConnection(wallet.provider)); } catch (error) { setWalletError(error instanceof Error ? error.message : String(error)); }
  }
  async function runWrite(functionName: string, args: (string | boolean)[]) {
    if (!wallet || wrongNetwork) throw new Error("Connect a wallet on Studio Dev before submitting a write.");
    setActionError(null);
    try { await submitWrite(functionName, args, wallet, setProgress); await refresh(); } catch (error) { const message = error instanceof Error ? error.message : String(error); const transactionHash = error instanceof WriteTransactionError ? error.transactionHash : undefined; setActionError(message); setProgress({ phase: "failed", label: transactionHash ? "TRANSACTION SUBMITTED — CHECK STATUS" : "TRANSACTION DID NOT COMPLETE", txHash: transactionHash, error: message }); throw error; }
  }

  const visibleRemoteCheck = snapshot?.evidenceSet ? (remoteChecking ? undefined : remoteCheck) : undefined;
  return <div className="site-page"><Navigation wallet={wallet} connecting={connecting} onConnect={() => void handleConnect()} onSwitchNetwork={() => void handleSwitchNetwork()} /><Hero snapshot={snapshot} loading={readState === "loading"} /><main><Intro /><StatementMarquee /><Protocol /><LiveAuthorization snapshot={snapshot} loading={readState === "loading"} /><EvidenceSection evidenceSet={snapshot?.evidenceSet} remoteCheck={visibleRemoteCheck} /><DecisionSection reviewReady={reviewReady} remoteCheck={visibleRemoteCheck} onReview={() => void runWrite("review_use", [snapshot?.request.request_id || ""])} /><PolicySection policy={snapshot?.policy} /><ProtocolSurface /><FinalCta onRequest={() => setRequestOpen(true)} onConnect={() => void handleConnect()} /></main><SiteFooter />{readState === "error" ? <div className="site-read-error"><span>LIVE READ UNAVAILABLE</span><p>{readError?.message || "Studio Dev could not be reached."}</p><button type="button" onClick={() => void refresh()}>Retry read</button></div> : null}{walletError ? <div className="site-wallet-error">{walletError}</div> : null}{actionError ? <div className="site-action-error">{actionError}</div> : null}<RequestSheet open={requestOpen} onOpenChange={setRequestOpen} wallet={wallet} wrongNetwork={wrongNetwork} progress={progress} onSubmit={(args) => runWrite("create_use_request", args)} />{progress && progress.phase !== "idle" ? <TransactionBanner progress={progress} onDismiss={() => setProgress(null)} /> : null}</div>;
}

export type { LiveSnapshot };
