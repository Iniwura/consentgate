"use client";

import {
  Activity,
  ArrowUpRight,
  CircleAlert,
  Database,
  Fingerprint,
  RefreshCw,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Dossier } from "@/components/consentgate/dossier";
import { EvidencePanel } from "@/components/consentgate/evidence-panel";
import { LifecycleRail } from "@/components/consentgate/lifecycle-rail";
import { PolicyPanel } from "@/components/consentgate/policy-panel";
import { RequestForm } from "@/components/consentgate/request-form";
import { SectionHeading } from "@/components/consentgate/section-heading";
import { StatusPill } from "@/components/consentgate/status-pill";
import { TransactionBanner } from "@/components/consentgate/transaction-banner";
import { WalletBar } from "@/components/consentgate/wallet-bar";
import { studioDevConfig } from "@/lib/config";
import {
  connectWallet,
  getBrowserProvider,
  getLiveSnapshot,
  readWalletConnection,
  submitWrite,
  switchToStudioDev,
  WriteTransactionError,
} from "@/lib/contract";
import { contractMethods } from "@/lib/contract";
import { verifyRemoteEvidence } from "@/lib/evidence";
import { formatUtc, shortAddress } from "@/lib/format";
import type { LiveSnapshot, WalletConnection, WriteProgress } from "@/lib/types";

export function ConsentGateWorkspace() {
  return (
    <main className="min-h-screen bg-[#131211] text-stone-100">
      <WorkspaceShell />
    </main>
  );
}

function WorkspaceShell() {
  const snapshotQuery = useQuery({
    queryKey: ["consentgate-live", studioDevConfig.contractAddress, studioDevConfig.policyId, studioDevConfig.requestId],
    queryFn: getLiveSnapshot,
    refetchInterval: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const evidenceQuery = useQuery({
    queryKey: ["consentgate-remote-evidence", snapshotQuery.data?.evidenceSet?.evidence_set_id],
    queryFn: () => verifyRemoteEvidence(snapshotQuery.data!.evidenceSet!),
    enabled: Boolean(snapshotQuery.data?.evidenceSet),
    retry: false,
  });
  const [wallet, setWallet] = useState<WalletConnection | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [progress, setProgress] = useState<WriteProgress | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const provider = getBrowserProvider();
    if (!provider) return;
    void readWalletConnection(provider).then(setWallet).catch(() => setWallet(null));
  }, []);

  const snapshot = snapshotQuery.data;
  const remoteStatus = evidenceQuery.data?.status === "checking" ? "idle" : evidenceQuery.data?.status ?? "idle";
  const wrongNetwork = Boolean(wallet && wallet.chainId !== studioDevConfig.chainId);
  const reviewReady = Boolean(
    snapshot?.request.effective_state === "USE_REQUEST_FROZEN" &&
      evidenceQuery.data?.status === "verified" &&
      wallet &&
      !wrongNetwork,
  );

  async function handleConnect() {
    setWalletError(null);
    setIsConnecting(true);
    try {
      setWallet(await connectWallet());
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleSwitchNetwork() {
    if (!wallet) return;
    setWalletError(null);
    try {
      await switchToStudioDev(wallet.provider);
      setWallet(await readWalletConnection(wallet.provider));
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : String(error));
    }
  }

  async function runWrite(functionName: string, args: (string | boolean)[]) {
    if (!wallet || wrongNetwork) {
      throw new Error("Connect a wallet on Studio Dev before submitting a write.");
    }
    setActionError(null);
    try {
      await submitWrite(functionName, args, wallet, setProgress);
      await snapshotQuery.refetch();
      await evidenceQuery.refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const transactionHash = error instanceof WriteTransactionError ? error.transactionHash : undefined;
      setProgress({ phase: "failed", label: transactionHash ? "TRANSACTION SUBMITTED — CHECK STATUS" : "TRANSACTION DID NOT COMPLETE", txHash: transactionHash, error: message });
      setActionError(message);
      throw error;
    }
  }

  async function runReview() {
    if (!snapshot || !reviewReady) return;
    await runWrite("review_use", [snapshot.request.request_id]);
  }

  return (
    <div className="mx-auto max-w-[1500px] px-4 pb-12 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-5 border-b border-stone-800/90 py-5">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl border border-amber-200/30 bg-amber-200/10 text-amber-100"><ShieldCheck className="size-5" /></div>
          <div>
            <div className="flex items-center gap-2"><span className="font-mono text-sm font-semibold tracking-tight text-stone-100">ConsentGate</span><span className="rounded bg-stone-800 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-stone-500">terminal</span></div>
            <p className="mt-0.5 text-[11px] text-stone-600">authorization state, evidence, and policy bindings</p>
          </div>
        </div>
        <WalletBar wallet={wallet} isConnecting={isConnecting} error={walletError} onConnect={handleConnect} onSwitchNetwork={handleSwitchNetwork} />
      </header>

      <section className="grid gap-6 pb-6 pt-8 lg:grid-cols-[minmax(0,1fr)_310px]">
        <div className="min-w-0">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2"><StatusPill label="LIVE READ" tone={snapshotQuery.isPending ? "loading" : snapshotQuery.isError ? "danger" : "success"} /><span className="font-mono text-[10px] text-stone-600">read-only until a wallet action is submitted</span></div>
              <h1 className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-stone-100 sm:text-4xl">Consent is a verifiable state transition.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-500">A production-facing terminal for checking whether a specific request is bound to a registered policy, a frozen evidence set, and remotely verifiable bytes.</p>
            </div>
            <button type="button" onClick={() => void snapshotQuery.refetch()} disabled={snapshotQuery.isFetching} className="terminal-button terminal-button-secondary"><RefreshCw className={`size-3.5 ${snapshotQuery.isFetching ? "animate-spin" : ""}`} /> Refresh state</button>
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <EnvironmentCell icon={<Activity className="size-4" />} label="Network" value={`${studioDevConfig.networkAlias} / ${studioDevConfig.chainId}`} />
            <EnvironmentCell icon={<Database className="size-4" />} label="Contract" value={shortAddress(studioDevConfig.contractAddress)} copyValue={studioDevConfig.contractAddress} />
            <EnvironmentCell icon={<Fingerprint className="size-4" />} label="Policy fixture" value={studioDevConfig.policyId} />
          </div>

          {snapshotQuery.isPending ? <LoadingCard label="Reading policy, request, and evidence-set state from Studio Dev…" /> : null}
          {snapshotQuery.isError ? <ErrorCard message={snapshotQuery.error instanceof Error ? snapshotQuery.error.message : String(snapshotQuery.error)} onRetry={() => void snapshotQuery.refetch()} /> : null}
          {snapshot ? (
            <div className="space-y-6">
              <Dossier policy={snapshot.policy} request={snapshot.request} />
              <PolicyPanel policy={snapshot.policy} />
              <EvidencePanel evidenceSet={snapshot.evidenceSet} remoteCheck={evidenceQuery.data} />
              <ReviewPanel snapshot={snapshot} remoteStatus={remoteStatus} reviewReady={reviewReady} walletReady={Boolean(wallet && !wrongNetwork)} actionError={actionError} onReview={() => void runReview()} />
              <RequestForm policyId={snapshot.policy.policy_id} wallet={wallet} wrongNetwork={wrongNetwork} progress={progress} onSubmit={(args) => runWrite("create_use_request", args)} />
              <ProtocolSurface />
            </div>
          ) : null}
        </div>
        <LifecycleRail policyReady={Boolean(snapshot?.policy)} requestState={snapshot?.request.effective_state || snapshot?.request.state || ""} evidenceReady={Boolean(snapshot?.evidenceSet)} remoteState={remoteStatus} reviewReady={reviewReady} />
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-800/90 pt-5 text-[10px] text-stone-600">
        <span className="font-mono">Studio Dev RPC · {studioDevConfig.rpcUrl}</span>
        <span>{snapshot?.readAt ? `last read ${formatUtc(snapshot.readAt)}` : "waiting for live state"}</span>
      </footer>
      {progress && progress.phase !== "idle" ? <TransactionBanner progress={progress} onDismiss={() => setProgress(null)} /> : null}
    </div>
  );
}

function EnvironmentCell({ icon, label, value, copyValue }: { icon: React.ReactNode; label: string; value: string; copyValue?: string }) {
  return <div className="metric-cell flex items-center gap-3"><div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-stone-800/70 text-amber-200/70">{icon}</div><div className="min-w-0"><p className="font-mono text-[9px] uppercase tracking-[0.13em] text-stone-600">{label}</p><p className="mt-1 truncate font-mono text-[11px] text-stone-300" title={copyValue || value}>{value}</p></div></div>;
}

function LoadingCard({ label }: { label: string }) {
  return <div className="terminal-card flex items-center gap-3 p-6 text-sm text-stone-400"><RefreshCw className="size-4 animate-spin text-amber-200/70" /> {label}</div>;
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="terminal-card border-red-300/20 p-6"><div className="flex items-start gap-3"><CircleAlert className="mt-0.5 size-4 shrink-0 text-red-300" /><div><p className="font-mono text-xs text-red-200">Studio Dev read failed</p><p className="mt-2 break-words text-xs leading-5 text-stone-500">{message}</p><button type="button" onClick={onRetry} className="terminal-button terminal-button-secondary mt-4">Retry read</button></div></div></div>;
}

function ReviewPanel({ snapshot, remoteStatus, reviewReady, walletReady, actionError, onReview }: { snapshot: LiveSnapshot; remoteStatus: string; reviewReady: boolean; walletReady: boolean; actionError: string | null; onReview: () => void }) {
  const result = snapshot.request.result;
  const isFrozen = snapshot.request.effective_state === "USE_REQUEST_FROZEN";
  return <section id="review" className="terminal-card scroll-mt-6 p-5 sm:p-6"><SectionHeading eyebrow="04 / decision boundary" title="Review authorization" detail="The evaluator is a wallet-gated write. This interface never infers a result from local data." action={<StatusPill label={reviewReady ? "READY" : "LOCKED"} tone={reviewReady ? "success" : "warning"} />} /><div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center"><div className="rounded-xl border border-stone-800 bg-[#171615] p-4"><div className="flex items-center gap-2 text-stone-400"><Terminal className="size-4 text-amber-200/70" /><span className="font-mono text-[10px] uppercase tracking-[0.15em]">On-chain result</span></div>{result ? <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-5 text-stone-300">{JSON.stringify(result, null, 2)}</pre> : <p className="mt-3 text-sm text-stone-500">No review result committed for this request.</p>}</div><div className="flex min-w-[220px] flex-col gap-2"><button type="button" disabled={!reviewReady} onClick={onReview} className="terminal-button terminal-button-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-35">Review frozen request <ArrowUpRight className="size-3.5" /></button><p className="text-center text-[10px] leading-4 text-stone-600">{!isFrozen ? "Freeze a request before review." : remoteStatus === "idle" ? "Checking public evidence URLs…" : remoteStatus !== "verified" ? "Review unavailable: frozen evidence is not publicly reachable yet." : !walletReady ? "Connect a wallet on Studio Dev." : "Simulation runs before the paid review write."}</p></div></div>{actionError ? <p className="mt-4 text-xs text-red-300">{actionError}</p> : null}</section>;
}

function ProtocolSurface() {
  const [open, setOpen] = useState(false);
  const writes = Object.keys(contractMethods).filter((method) => !method.startsWith("get_"));
  const views = Object.keys(contractMethods).filter((method) => method.startsWith("get_"));
  return <section id="protocol" className="terminal-card scroll-mt-6 p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><SectionHeading eyebrow="06 / contract surface" title="ConsentGate methods" detail="Exact deployed public surface mirrored from the canonical contract." /><button type="button" onClick={() => setOpen((current) => !current)} className="terminal-button terminal-button-secondary shrink-0">{open ? "Collapse" : "Expand"}</button></div>{open ? <div className="grid gap-5 border-t border-stone-800 pt-5 md:grid-cols-2"><MethodGroup title={`Writes · ${writes.length}`} methods={writes} tone="amber" /><MethodGroup title={`Views · ${views.length}`} methods={views} tone="emerald" /></div> : <p className="border-t border-stone-800 pt-4 text-xs text-stone-600">17 public methods · 13 writes · 4 views</p>}</section>;
}

function MethodGroup({ title, methods, tone }: { title: string; methods: string[]; tone: "amber" | "emerald" }) {
  return <div><p className={`mb-2 font-mono text-[10px] uppercase tracking-[0.14em] ${tone === "amber" ? "text-amber-200/70" : "text-emerald-300/70"}`}>{title}</p><div className="flex flex-wrap gap-2">{methods.map((method) => <span key={method} className="rounded-md border border-stone-800 bg-[#171615] px-2.5 py-1.5 font-mono text-[10px] text-stone-400">{method}</span>)}</div></div>;
}
