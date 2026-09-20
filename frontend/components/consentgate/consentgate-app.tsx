"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  FileCheck2,
  Fingerprint,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Menu,
  RefreshCw,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import {
  connectWallet,
  getBrowserProvider,
  getCapability,
  getEvidenceSet,
  getPolicy,
  getUseRequest,
  readWalletConnection,
  submitWrite,
  switchToStudioDev,
} from "@/lib/contract";
import { studioDevConfig } from "@/lib/config";
import { verifyRemoteEvidence } from "@/lib/evidence";
import type {
  CapabilityRecord,
  EvidenceSetRecord,
  PolicyRecord,
  PolicyRule,
  RemoteEvidenceCheck,
  UseRequestRecord,
  WalletConnection,
  WriteProgress,
} from "@/lib/types";

type ViewMode = "home" | "request" | "request-detail" | "policies" | "policy-detail" | "live";
type WriteArg = string | boolean | number;

type RequestDraft = {
  requestId: string;
  policyId: string;
  resourceId: string;
  purpose: string;
  dataCategory: string;
  recipient: string;
  requestExpiry: string;
  retentionUntil: string;
  sharingMode: string;
  commercialUse: boolean;
  replayNonce: string;
};

type EvidenceDraft = {
  evidenceId: string;
  sourceUrl: string;
  contentHash: string;
  attestationUrl: string;
  attestationHash: string;
  evidenceVersion: string;
  issuedAt: string;
  expiresAt: string;
};

const RULE_DIMENSIONS = [
  ["POLICY_BINDING", "Request and evidence bind to the registered policy."],
  ["CONSENT_EXPIRY", "Consent evidence is current at review time."],
  ["PURPOSE", "The requested purpose is permitted."],
  ["DATA_CATEGORY", "The requested data category is permitted."],
  ["RECIPIENT", "The recipient is permitted."],
  ["RETENTION", "Retention stays inside the validity window."],
  ["SHARING", "Sharing mode matches the registered boundary."],
  ["COMMERCIAL_USE", "Commercial use matches the registered boundary."],
  ["EVIDENCE_SUFFICIENCY", "Evidence is sufficient for the exact use."],
] as const;

const RESULT_DIMENSIONS = [
  ["policy_binding_valid", "Policy binding"],
  ["consent_unexpired", "Consent expiry"],
  ["purpose_allowed", "Purpose"],
  ["data_category_allowed", "Data category"],
  ["recipient_allowed", "Recipient"],
  ["retention_allowed", "Retention"],
  ["sharing_allowed", "Sharing"],
  ["commercial_use_allowed", "Commercial use"],
  ["evidence_sufficient", "Evidence sufficiency"],
] as const;

const DEFAULT_RULES: PolicyRule[] = RULE_DIMENSIONS.map(([dimension, description], index) => ({
  rule_id: `r${String(index + 1).padStart(2, "0")}`,
  dimension,
  description,
}));

const DEFAULT_AUTHORITIES = JSON.stringify([{
  authority_id: "demoauthority",
  authority_key_id: "demokeyv1",
  origin: "https://raw.githubusercontent.com",
  attestation_path_prefix: "/Iniwura/consentgate/main/evidence/",
}], null, 2);

function futureUtc(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString().replace(".000Z", "Z");
}

function makeId(prefix: string) {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `${prefix}-${uuid ? uuid.replaceAll("-", "").slice(0, 18) : Date.now().toString(36)}`;
}

function shortValue(value: string | undefined, start = 9, end = 7) {
  if (!value) return "—";
  if (value.length <= start + end + 1) return value;
  return `${value.slice(0, start)}…${value.slice(-end)}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function addressEqual(left: string | undefined, right: string | undefined) {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
}

function statusTone(status: string | undefined) {
  if (["AUTHORIZED", "POLICY_REGISTERED", "CAPABILITY_ISSUED", "CAPABILITY_CONSUMED", "USE_REQUEST_FROZEN", "verified"].includes(status || "")) return "good";
  if (["USE_REQUEST_OPEN", "REVIEW_RETRY_REQUIRED", "EVIDENCE_REPAIR_REQUIRED", "checking"].includes(status || "")) return "warn";
  if (["DENIED", "REVOKED", "EXPIRED", "CANCELLED", "unavailable", "mismatch"].includes(status || "")) return "bad";
  return "neutral";
}

function recordState(request: UseRequestRecord | null) {
  return request?.effective_state || request?.state || "NOT LOADED";
}

function canReview(request: UseRequestRecord | null) {
  return Boolean(request && ["USE_REQUEST_FROZEN", "EVIDENCE_REPAIR_REQUIRED"].includes(recordState(request)));
}

function canIssue(request: UseRequestRecord | null) {
  return recordState(request) === "AUTHORIZED" && !request?.capability_id;
}

function AppLogo() {
  return <Link className="cg-app-logo" href="/" aria-label="ConsentGate home"><span className="cg-logo-mark"><ShieldCheck size={16} /></span><span>Consent<span>Gate</span></span></Link>;
}

export function ConsentGateLanding() {
  return (
    <div className="cg-landing">
      <header className="cg-landing-nav cg-shell"><AppLogo /><nav><Link href="/app">Open app</Link><Link href="/app/live">Live proof</Link></nav><Link className="cg-nav-button" href="/app/request">New request <ArrowRight size={14} /></Link></header>
      <main>
        <section className="cg-landing-hero cg-shell">
          <div className="cg-landing-kicker"><span className="cg-pulse" /> GENLAYER / STUDIO DEV / 61997</div>
          <div className="cg-landing-hero-grid"><div><h1>CONSENT<br />BEFORE<br /><em>ACCESS.</em></h1><p className="cg-landing-lede">ConsentGate is a verifiable authorization layer for data use. Define the use, bind the evidence, review the policy, then issue access only when the record authorizes it.</p><div className="cg-landing-actions"><Link className="cg-button cg-button-dark" href="/app">Enter ConsentGate <ArrowRight size={15} /></Link><Link className="cg-button cg-button-outline" href="/app/live">Inspect live proof <ExternalLink size={14} /></Link></div></div><AuthorizationSeal /></div>
          <div className="cg-landing-meta"><span>Consent Receipt / Authorization Record</span><span>Studio Dev connected · contract verified</span></div>
        </section>
        <section className="cg-receipt-band"><div className="cg-shell cg-receipt-grid"><div className="cg-receipt-label">01 / Authorization record</div><div><h2>A decision you can inspect.</h2><p>Every authorization is a record of policy, evidence, model evaluation, and exact bindings. Nothing is reduced to a score.</p></div><AuthorizationReceipt /></div></section>
        <section className="cg-shell cg-landing-section"><SectionMarker number="02" label="The protocol" /><h2 className="cg-display-heading">From a stated use<br />to a bounded capability.</h2><div className="cg-protocol-strip"><ProtocolItem number="01" title="Request" text="State the resource, purpose, recipient, and time window." /><ProtocolItem number="02" title="Evidence" text="Attach consent evidence and an attestation, then freeze the set." /><ProtocolItem number="03" title="Review" text="Evaluate the frozen record against nine policy dimensions." /><ProtocolItem number="04" title="Capability" text="Issue a capability bound to the authorization result." /></div></section>
        <section className="cg-shell cg-landing-section cg-split-section"><div><SectionMarker number="03" label="Why ConsentGate" /><h2 className="cg-display-heading">Access should carry its proof.</h2></div><div className="cg-copy-stack"><p>Authorization is not a green light floating above the system. It is a persistent, inspectable record tied to the exact request and evidence that produced it.</p><p>ConsentGate gives teams a clean boundary: policy before use, evidence before review, capability before access.</p><Link className="cg-text-button" href="/app/live">See the tested authorization record <ArrowRight size={14} /></Link></div></section>
      </main>
      <footer className="cg-landing-footer cg-shell"><AppLogo /><span>Policy · Evidence · Consensus · Capability</span><span>Studio Dev / 61997</span></footer>
    </div>
  );
}

function AuthorizationSeal() {
  return <div className="cg-seal-art"><div className="cg-seal-ring"><span>CG</span><small>VERIFIABLE<br />AUTHORIZATION</small></div><div className="cg-seal-lines"><span>POLICY REGISTERED</span><span>EVIDENCE BOUND</span><span>ACCESS CONDITIONAL</span></div></div>;
}

function AuthorizationReceipt() {
  return <div className="cg-receipt-card"><div className="cg-receipt-top"><span>CONSENT RECEIPT</span><span>CG / 61997</span></div><div className="cg-receipt-main"><FileCheck2 size={28} /><strong>AUTHORIZE</strong><span>Exact use · exact evidence · exact result</span></div><div className="cg-receipt-bottom"><span>POLICY → REVIEW → CAPABILITY</span><span>RECORDED</span></div></div>;
}

function SectionMarker({ number, label }: { number: string; label: string }) {
  return <div className="cg-section-marker"><span>{number}</span><span>{label}</span></div>;
}

function ProtocolItem({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="cg-protocol-item"><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div><ChevronRight size={17} /></div>;
}

export function ConsentGateApp({ mode, recordId }: { mode: ViewMode; recordId?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletConnection | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [progress, setProgress] = useState<WriteProgress | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const wrongNetwork = Boolean(wallet && wallet.chainId !== studioDevConfig.chainId);
  const busy = ["simulating", "awaiting-wallet", "finalizing"].includes(progress?.phase || "");

  useEffect(() => { const provider = getBrowserProvider(); if (provider) void readWalletConnection(provider).then(setWallet).catch(() => setWallet(null)); }, []);

  async function connect() { setWalletError(null); setConnecting(true); try { setWallet(await connectWallet()); } catch (error) { setWalletError(errorMessage(error)); } finally { setConnecting(false); } }
  async function switchNetwork() { if (!wallet) return; try { await switchToStudioDev(wallet.provider); setWallet(await readWalletConnection(wallet.provider)); } catch (error) { setWalletError(errorMessage(error)); } }
  const write = useCallback(async (method: string, args: WriteArg[]) => { if (!wallet || wrongNetwork) { setActionError("Connect a wallet on Studio Dev before submitting a write."); return false; } setActionError(null); try { const result = await submitWrite(method, args, wallet, setProgress); setLastTxHash(result.hash); return true; } catch (error) { const message = errorMessage(error); setActionError(message); setProgress({ phase: "failed", label: "Transaction did not complete", error: message }); return false; } }, [wallet, wrongNetwork]);
  const activeLink = pathname?.startsWith("/app/policies") || pathname?.startsWith("/app/policy/") ? "policies" : pathname?.startsWith("/app/live") ? "live" : pathname?.startsWith("/app/request") ? "requests" : "home";
  return <div className="cg-product"><header className="cg-product-nav cg-shell"><AppLogo /><nav className={`cg-product-links ${mobileNav ? "is-open" : ""}`}><Link className={activeLink === "home" ? "is-active" : ""} href="/app" onClick={() => setMobileNav(false)}>Home</Link><Link className={activeLink === "requests" ? "is-active" : ""} href="/app/request" onClick={() => setMobileNav(false)}>Requests</Link><Link className={activeLink === "policies" ? "is-active" : ""} href="/app/policies" onClick={() => setMobileNav(false)}>Policies</Link><Link className={activeLink === "live" ? "is-active" : ""} href="/app/live" onClick={() => setMobileNav(false)}>Live proof</Link></nav><div className="cg-product-nav-actions"><span className={`cg-network ${wrongNetwork ? "is-wrong" : ""}`}><span className="cg-pulse" />{wrongNetwork ? "Wrong network" : "Studio Dev"}</span>{wallet ? <button className={`cg-wallet ${wrongNetwork ? "is-wrong" : ""}`} type="button" onClick={wrongNetwork ? switchNetwork : connect}>{wrongNetwork ? "Switch network" : shortValue(wallet.address, 6, 4)}</button> : <button className="cg-connect" type="button" onClick={connect} disabled={connecting}><Wallet size={14} />{connecting ? "Connecting…" : "Connect wallet"}</button>}<button className="cg-nav-menu" type="button" aria-label="Toggle navigation" onClick={() => setMobileNav((value) => !value)}>{mobileNav ? <X size={18} /> : <Menu size={18} />}</button></div></header>{walletError ? <Notice kind="error" message={walletError} onDismiss={() => setWalletError(null)} /> : null}{actionError ? <Notice kind="error" message={actionError} onDismiss={() => setActionError(null)} /> : null}{progress && progress.phase !== "idle" ? <TransactionNotice progress={progress} onDismiss={() => setProgress(null)} /> : null}<main className="cg-product-main">{mode === "home" ? <AppHome /> : null}{mode === "request" ? <RequestPage wallet={wallet} wrongNetwork={wrongNetwork} busy={busy} onWrite={write} onCreated={(id) => router.push(`/app/request/${encodeURIComponent(id)}`)} /> : null}{mode === "request-detail" ? <RequestDossier requestId={recordId || ""} wallet={wallet} wrongNetwork={wrongNetwork} busy={busy} progress={progress} lastTxHash={lastTxHash} onWrite={write} /> : null}{mode === "policies" ? <PoliciesPage wallet={wallet} wrongNetwork={wrongNetwork} busy={busy} onWrite={write} /> : null}{mode === "policy-detail" ? <PolicyDetail policyId={recordId || ""} wallet={wallet} wrongNetwork={wrongNetwork} busy={busy} onWrite={write} /> : null}{mode === "live" ? <LiveProof /> : null}</main><footer className="cg-product-footer cg-shell"><span>ConsentGate / Studio Dev</span><span>Contract {shortValue(studioDevConfig.contractAddress, 8, 6)}</span><span>Chain {studioDevConfig.chainId}</span></footer></div>;
}

function AppHome() { return <div className="cg-page cg-home-page"><PageIntro eyebrow="ConsentGate / Workspace" title="What do you want to authorize?" detail="Create a bounded use request, inspect an existing record, or open the tested authorization proof." /><div className="cg-action-grid"><HomeAction number="01" title="New request" detail="Define one exact use of data against a registered policy." href="/app/request" /><HomeAction number="02" title="Inspect request" detail="Read the live lifecycle of an existing request." href={`/app/request/${encodeURIComponent(studioDevConfig.requestId)}`} /><HomeAction number="03" title="Policies" detail="Register, inspect, and revoke policy records." href="/app/policies" /><HomeAction number="04" title="Live proof" detail="Inspect the authoritative Studio Dev happy path." href="/app/live" /></div><div className="cg-home-note"><LockKeyhole size={16} /><span>Live values are read from the deployed ConsentGate contract. Form values remain local until a wallet-approved write is finalized.</span></div></div>; }
function HomeAction({ number, title, detail, href }: { number: string; title: string; detail: string; href: string }) { return <Link className="cg-home-action" href={href}><span>{number}</span><div><h2>{title}</h2><p>{detail}</p></div><ArrowRight size={18} /></Link>; }
function PageIntro({ eyebrow, title, detail, back }: { eyebrow: string; title: string; detail: string; back?: string }) { return <div className="cg-page-intro">{back ? <Link className="cg-back-link" href={back}><ArrowLeft size={14} /> Back</Link> : null}<div className="cg-page-kicker">{eyebrow}</div><h1>{title}</h1><p>{detail}</p></div>; }

function RequestPage({ wallet, wrongNetwork, busy, onWrite, onCreated }: { wallet: WalletConnection | null; wrongNetwork: boolean; busy: boolean; onWrite: (method: string, args: WriteArg[]) => Promise<boolean>; onCreated: (id: string) => void }) {
  const [policyId, setPolicyId] = useState(studioDevConfig.policyId); const [policy, setPolicy] = useState<PolicyRecord | null>(null); const [lookupError, setLookupError] = useState<string | null>(null); const [draft, setDraft] = useState<RequestDraft>({ requestId: "", policyId: studioDevConfig.policyId, resourceId: "", purpose: "", dataCategory: "", recipient: "", requestExpiry: futureUtc(2), retentionUntil: futureUtc(1), sharingMode: "NONE", commercialUse: false, replayNonce: "" }); const [created, setCreated] = useState<string | null>(null);
  async function inspect() { setLookupError(null); try { const next = await getPolicy(policyId.trim()); setPolicy(next); setDraft((current) => ({ ...current, policyId: next.policy_id, resourceId: current.resourceId || next.resource_id })); } catch (error) { setLookupError(errorMessage(error)); } }
  function patch(next: Partial<RequestDraft>) { setDraft((current) => ({ ...current, ...next })); }
  async function submit(event: FormEvent) { event.preventDefault(); const requestId = draft.requestId.trim() || makeId("request"); const replayNonce = draft.replayNonce.trim() || makeId("replay"); const effectivePolicy = draft.policyId.trim() || policy?.policy_id || ""; const resourceId = draft.resourceId.trim() || policy?.resource_id || ""; if (!effectivePolicy || !resourceId || !draft.purpose.trim() || !draft.dataCategory.trim() || !draft.recipient.trim()) return; patch({ requestId, replayNonce, policyId: effectivePolicy, resourceId }); const ok = await onWrite("create_use_request", [requestId, effectivePolicy, resourceId, draft.purpose.trim(), draft.dataCategory.trim(), draft.recipient.trim(), draft.requestExpiry.trim(), draft.retentionUntil.trim(), draft.sharingMode, draft.commercialUse, replayNonce]); if (ok) { setCreated(requestId); onCreated(requestId); } }
  return <div className="cg-page cg-form-page"><PageIntro eyebrow="Requests / Create" title="State the exact use." detail="A request is the boundary around one intended access. The contract records these values only after wallet approval and finalization." back="/app" /><div className="cg-form-layout"><form className="cg-form-card" onSubmit={submit}><FormSection title="Registered policy" note="Read from Studio Dev or enter another policy ID."><div className="cg-input-row"><TextInput label="Policy ID" value={policyId} onChange={setPolicyId} /><button className="cg-button cg-button-outline cg-inspect-button" type="button" onClick={() => void inspect()}>Inspect policy <RefreshCw size={14} /></button></div>{lookupError ? <InlineError message={lookupError} /> : null}{policy ? <ReadbackStrip title="Policy readback" items={[["resource", policy.resource_id], ["owner", shortValue(policy.owner)], ["status", policy.revoked ? "REVOKED" : policy.expired ? "EXPIRED" : policy.state]]} tone={statusTone(policy.state)} /> : <p className="cg-form-note">No policy has been read yet. Inspect a registered policy before creating the request.</p>}</FormSection><FormSection title="Use definition" note="These fields become the request fingerprint."><div className="cg-input-grid"><TextInput label="Resource ID" value={draft.resourceId} onChange={(value) => patch({ resourceId: value })} required /><TextInput label="Recipient" value={draft.recipient} onChange={(value) => patch({ recipient: value })} required /><TextInput label="Purpose" value={draft.purpose} onChange={(value) => patch({ purpose: value })} required /><TextInput label="Data category" value={draft.dataCategory} onChange={(value) => patch({ dataCategory: value })} required /><TextInput label="Retention until (UTC)" value={draft.retentionUntil} onChange={(value) => patch({ retentionUntil: value })} type="datetime-local" required /><TextInput label="Request expires (UTC)" value={draft.requestExpiry} onChange={(value) => patch({ requestExpiry: value })} type="datetime-local" required /><SelectInput label="Sharing mode" value={draft.sharingMode} onChange={(value) => patch({ sharingMode: value })} options={["NONE", "INTERNAL", "EXTERNAL"]} /><label className="cg-check-field"><input type="checkbox" checked={draft.commercialUse} onChange={(event) => patch({ commercialUse: event.target.checked })} /><span><strong>Commercial use</strong><small>Mark only when this use is commercial.</small></span></label></div></FormSection><FormSection title="Identifiers" note="Blank values are generated locally before submission."><div className="cg-input-grid"><TextInput label="Request ID" value={draft.requestId} onChange={(value) => patch({ requestId: value })} placeholder="Generated if blank" /><TextInput label="Replay nonce" value={draft.replayNonce} onChange={(value) => patch({ replayNonce: value })} placeholder="Generated if blank" /></div></FormSection><div className="cg-form-footer"><div><span className="cg-form-note">Writes simulate first, then request wallet approval.</span>{created ? <strong className="cg-created-label">Created: {created}</strong> : null}</div><button className="cg-button cg-button-dark" type="submit" disabled={busy || !wallet || wrongNetwork || !policy}>{busy ? "Simulating…" : wrongNetwork ? "Switch to Studio Dev" : !wallet ? "Connect wallet to create" : "Create use request"}<ArrowRight size={15} /></button></div></form><aside className="cg-side-note"><Fingerprint size={21} /><h2>The request is the record.</h2><p>Purpose, category, recipient, sharing, commercial use, retention, and expiry are all carried into the authorization path.</p><Link className="cg-text-button" href="/app/live">See a completed record <ArrowRight size={14} /></Link></aside></div></div>;
}

function RequestDossier({ requestId, wallet, wrongNetwork, busy, progress, lastTxHash, onWrite }: { requestId: string; wallet: WalletConnection | null; wrongNetwork: boolean; busy: boolean; progress: WriteProgress | null; lastTxHash: string | null; onWrite: (method: string, args: WriteArg[]) => Promise<boolean> }) {
  const [request, setRequest] = useState<UseRequestRecord | null>(null); const [policy, setPolicy] = useState<PolicyRecord | null>(null); const [evidence, setEvidence] = useState<EvidenceSetRecord | null>(null); const [capability, setCapability] = useState<CapabilityRecord | null>(null); const [remote, setRemote] = useState<RemoteEvidenceCheck | undefined>(); const [readState, setReadState] = useState<"idle" | "loading" | "ready" | "error">("idle"); const [error, setError] = useState<string | null>(null); const [evidenceDraft, setEvidenceDraft] = useState<EvidenceDraft>({ evidenceId: "", sourceUrl: "", contentHash: "", attestationUrl: "", attestationHash: "", evidenceVersion: "v1", issuedAt: new Date().toISOString().replace(".000Z", "Z"), expiresAt: "" }); const [presentationNonce, setPresentationNonce] = useState("");
  const load = useCallback(async () => { if (!requestId) return; setReadState("loading"); try { const nextRequest = await getUseRequest(requestId); const [nextPolicy, nextEvidence, nextCapability] = await Promise.all([getPolicy(nextRequest.policy_id), nextRequest.evidence_set_id ? getEvidenceSet(nextRequest.evidence_set_id) : Promise.resolve(null), nextRequest.capability_id ? getCapability(nextRequest.capability_id) : Promise.resolve(null)]); setRequest(nextRequest); setPolicy(nextPolicy); setEvidence(nextEvidence); setCapability(nextCapability); setRemote(nextEvidence ? await verifyRemoteEvidence(nextEvidence) : undefined); setError(null); setReadState("ready"); } catch (nextError) { setError(errorMessage(nextError)); setReadState("error"); } }, [requestId]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  const manifest = useMemo(() => { if (!request || !policy) return null; const entry = { evidence_id: evidenceDraft.evidenceId || `consent-record-${request.request_id}`, evidence_kind: "consent-record", authority_id: policy.allowed_authorities[0]?.authority_id || "demoauthority", source_url: evidenceDraft.sourceUrl, version: "v1", content_sha256: evidenceDraft.contentHash, issued_at_utc: evidenceDraft.issuedAt || new Date().toISOString().replace(".000Z", "Z"), expires_at_utc: evidenceDraft.expiresAt || request.retention_until_utc, attestation_hash: evidenceDraft.attestationHash, attestation_url: evidenceDraft.attestationUrl, required: true }; return { schema_version: "consentgate.v2", policy_id: request.policy_id, policy_fingerprint: request.policy_fingerprint, request_id: request.request_id, request_fingerprint: request.request_fingerprint, resource_id: request.resource_id, evidence_version: evidenceDraft.evidenceVersion || "v1", entries: [entry] }; }, [evidenceDraft, policy, request]);
  async function refreshAfter(method: string, args: WriteArg[]) { const ok = await onWrite(method, args); if (ok) await load(); }
  async function freeze(event: FormEvent) { event.preventDefault(); if (!request || !manifest) return; const method = recordState(request) === "EVIDENCE_REPAIR_REQUIRED" ? "repair_evidence" : "freeze_use_request"; await refreshAfter(method, [request.request_id, evidenceDraft.evidenceVersion || "v1", JSON.stringify(manifest)]); }
  async function review() { if (request) await refreshAfter("review_use", [request.request_id]); }
  async function issue() { if (request) await refreshAfter("issue_capability", [request.request_id]); }
  async function consume() { if (!capability) return; await refreshAfter("consume_capability", [capability.capability_id, presentationNonce.trim(), capability.resource_id, capability.purpose, capability.recipient, capability.sharing_mode, capability.commercial_use]); }
  async function revoke() { if (capability) await refreshAfter("revoke_capability", [capability.capability_id]); }
  if (!requestId) return <EmptyState title="No request selected" detail="Choose a request ID from the Requests view." href="/app" />;
  return <div className="cg-page cg-dossier-page"><PageIntro eyebrow="Requests / Authorization dossier" title={request ? shortValue(request.request_id, 17, 12) : "Loading request…"} detail="A live record of the request, its evidence, review result, and any capability issued from it." back="/app" /><div className="cg-dossier-toolbar"><span className={`cg-status cg-status-${statusTone(recordState(request))}`}><i />{recordState(request)}</span><button className="cg-button cg-button-outline" type="button" onClick={() => void load()} disabled={readState === "loading"}><RefreshCw size={14} className={readState === "loading" ? "cg-spin" : ""} /> Refresh live record</button></div>{error ? <InlineError message={error} /> : null}{request ? <><div className="cg-dossier-card"><div className="cg-dossier-card-head"><div><span className="cg-card-kicker">01 / Request</span><h2>{request.purpose}</h2></div><CopyValue value={request.request_id} /></div><div className="cg-data-grid">{[["request ID", request.request_id], ["policy ID", request.policy_id], ["resource", request.resource_id], ["requester", request.requester], ["recipient", request.recipient], ["data category", request.data_category], ["sharing", request.sharing_mode], ["commercial", String(request.commercial_use)], ["expires", request.request_expires_at_utc], ["retention", request.retention_until_utc], ["request fingerprint", request.request_fingerprint]].map(([label, value]) => <DataCell key={label} label={label} value={value} />)}</div></div><div className="cg-lifecycle"><LifecycleStep number="01" title="Request" state={request.state} detail="The use is defined and fingerprinted." done /><LifecycleStep number="02" title="Evidence" state={evidence ? evidence.consumed ? "CONSUMED" : "FROZEN" : "OPEN"} detail="Consent evidence is attached and frozen." done={Boolean(evidence)} /><LifecycleStep number="03" title="Review" state={request.result ? String(request.result.review_status || request.result.result_kind || "COMPLETE") : "PENDING"} detail="The frozen record is evaluated against policy." done={Boolean(request.result)} /><LifecycleStep number="04" title="Capability" state={capability?.effective_status || (request.capability_id ? "ISSUED" : "PENDING")} detail="Access is issued only from an authorization." done={Boolean(capability)} /></div><EvidencePanel request={request} policy={policy} evidence={evidence} remote={remote} draft={evidenceDraft} setDraft={setEvidenceDraft} manifest={manifest} onFreeze={freeze} busy={busy} wallet={wallet} wrongNetwork={wrongNetwork} /><ReviewPanel request={request} evidence={evidence} remote={remote} onReview={() => void review()} busy={busy} wallet={wallet} wrongNetwork={wrongNetwork} progress={progress} lastTxHash={lastTxHash} /><CapabilityPanel request={request} capability={capability} nonce={presentationNonce} setNonce={setPresentationNonce} onIssue={() => void issue()} onConsume={() => void consume()} onRevoke={() => void revoke()} busy={busy} wallet={wallet} wrongNetwork={wrongNetwork} /></> : readState === "loading" ? <LoadingState label="Reading request from Studio Dev…" /> : <EmptyState title="Request unavailable" detail="The configured request could not be read from Studio Dev." href="/app/request" />}</div>;
}

function LifecycleStep({ number, title, state, detail, done }: { number: string; title: string; state: string; detail: string; done: boolean }) { return <div className={`cg-lifecycle-step ${done ? "is-done" : ""}`}><span>{number}</span><div><h3>{title}</h3><p>{detail}</p></div><strong>{state}</strong></div>; }

function EvidencePanel({ request, evidence, remote, draft, setDraft, manifest, onFreeze, busy, wallet, wrongNetwork }: { request: UseRequestRecord; policy?: PolicyRecord | null; evidence: EvidenceSetRecord | null; remote?: RemoteEvidenceCheck; draft: EvidenceDraft; setDraft: (value: EvidenceDraft | ((current: EvidenceDraft) => EvidenceDraft)) => void; manifest: Record<string, unknown> | null; onFreeze: (event: FormEvent) => void; busy: boolean; wallet: WalletConnection | null; wrongNetwork: boolean }) {
  const state = recordState(request); const editable = ["USE_REQUEST_OPEN", "EVIDENCE_REPAIR_REQUIRED"].includes(state); function patch(next: Partial<EvidenceDraft>) { setDraft((current) => ({ ...current, ...next })); }
  return <section className="cg-dossier-section"><SectionMarker number="02" label="Evidence" /><div className="cg-section-heading"><div><h2>Consent evidence</h2><p>The evidence set must bind to this request fingerprint and policy before review can run.</p></div>{evidence && !editable ? <StatusBadge status={remote?.status === "verified" ? "verified" : evidence.consumed ? "consumed" : "frozen"} /> : <StatusBadge status={editable ? "awaiting input" : state} />}</div>{editable ? <form className="cg-evidence-form" onSubmit={onFreeze}><div className="cg-input-grid"><TextInput label="Evidence ID" value={draft.evidenceId} onChange={(value) => patch({ evidenceId: value })} placeholder={`consent-record-${request.request_id}`} /><TextInput label="Evidence version" value={draft.evidenceVersion} onChange={(value) => patch({ evidenceVersion: value })} required /><TextInput label="Source URL" value={draft.sourceUrl} onChange={(value) => patch({ sourceUrl: value })} required /><TextInput label="Content SHA-256" value={draft.contentHash} onChange={(value) => patch({ contentHash: value })} required /><TextInput label="Attestation URL" value={draft.attestationUrl} onChange={(value) => patch({ attestationUrl: value })} required /><TextInput label="Attestation hash" value={draft.attestationHash} onChange={(value) => patch({ attestationHash: value })} required /><TextInput label="Issued at (UTC)" value={draft.issuedAt} onChange={(value) => patch({ issuedAt: value })} required /><TextInput label="Expires at (UTC)" value={draft.expiresAt || request.retention_until_utc} onChange={(value) => patch({ expiresAt: value })} required /></div><div className="cg-manifest-preview"><span>LOCAL MANIFEST PREVIEW</span><code>{manifest ? JSON.stringify(manifest, null, 2) : "Complete the evidence fields to preview the exact JSON."}</code></div><div className="cg-form-footer"><span className="cg-form-note">After freezing, the contract retains the evidence-set fingerprint. Remote URLs are verified before review.</span><button className="cg-button cg-button-dark" type="submit" disabled={busy || !wallet || wrongNetwork}>{state === "EVIDENCE_REPAIR_REQUIRED" ? "Repair and freeze evidence" : "Freeze evidence set"}<ArrowRight size={15} /></button></div></form> : evidence ? <><div className="cg-data-grid cg-data-grid-tight">{[["evidence set", evidence.evidence_set_id], ["evidence fingerprint", evidence.evidence_set_fingerprint], ["policy fingerprint", evidence.policy_fingerprint], ["request fingerprint", evidence.request_fingerprint], ["consumed", String(evidence.consumed)], ["superseded", String(evidence.superseded)]].map(([label, value]) => <DataCell key={label} label={label} value={value} />)}</div><RemoteEvidence remote={remote} evidence={evidence} /></> : <LockedPanel title="Evidence is not editable at this state" detail={`Current request state: ${state}`} />}</section>;
}

function ReviewPanel({ request, evidence, remote, onReview, busy, wallet, wrongNetwork, progress, lastTxHash }: { request: UseRequestRecord; evidence: EvidenceSetRecord | null; remote?: RemoteEvidenceCheck; onReview: () => void; busy: boolean; wallet: WalletConnection | null; wrongNetwork: boolean; progress: WriteProgress | null; lastTxHash: string | null }) {
  const result = request.result; const resultStatus = typeof result?.review_status === "string" ? result.review_status : result ? String(result.result_kind || "COMPLETE") : "PENDING";
  return <section className="cg-dossier-section"><SectionMarker number="03" label="Review" /><div className="cg-section-heading"><div><h2>Semantic review</h2><p>Review uses the deployed evaluator on the frozen evidence set. The decision and nine rule dimensions are read back from the contract.</p></div><StatusBadge status={resultStatus} /></div>{result ? <div className="cg-review-result"><div className="cg-review-head"><strong>{resultStatus}</strong><span>{String(result.decision || "No decision")}</span></div><div className="cg-check-grid">{RESULT_DIMENSIONS.map(([key, label]) => <div key={key} className={result[key] === true ? "is-pass" : "is-fail"}><span>{result[key] === true ? <Check size={13} /> : <X size={13} />}</span><strong>{label}</strong><small>{String(result[key])}</small></div>)}</div><div className="cg-result-footer"><span>result fingerprint</span><CopyValue value={request.result_fingerprint} /></div></div> : <div className="cg-action-panel"><div><span className="cg-card-kicker">Review not yet persisted</span><h3>{evidence ? "The evidence set is ready for review." : "Freeze an evidence set before review."}</h3><p>{remote?.status === "mismatch" ? "Remote evidence does not match the frozen hashes." : remote?.status === "unavailable" ? "Remote evidence could not be verified yet." : "No decision is displayed until the contract returns one."}</p></div><button className="cg-button cg-button-dark" type="button" onClick={onReview} disabled={!canReview(request) || busy || !evidence || !wallet || wrongNetwork}>{busy ? "Submitting…" : "Run review_use"}<ArrowRight size={15} /></button></div>}{progress?.txHash || lastTxHash ? <div className="cg-tx-line"><span>latest transaction</span><a href={`${studioDevConfig.explorerUrl}/tx/${progress?.txHash || lastTxHash}`} target="_blank" rel="noreferrer">{shortValue(progress?.txHash || lastTxHash || "")} <ExternalLink size={12} /></a></div> : null}</section>;
}

function CapabilityPanel({ request, capability, nonce, setNonce, onIssue, onConsume, onRevoke, busy, wallet, wrongNetwork }: { request: UseRequestRecord; capability: CapabilityRecord | null; nonce: string; setNonce: (value: string) => void; onIssue: () => void; onConsume: () => void; onRevoke: () => void; busy: boolean; wallet: WalletConnection | null; wrongNetwork: boolean }) {
  return <section className="cg-dossier-section"><SectionMarker number="04" label="Capability" /><div className="cg-section-heading"><div><h2>Access pass</h2><p>A capability is bound to the authorization result and exact use parameters. The presentation nonce is transaction calldata, not persisted secret state.</p></div><StatusBadge status={capability?.effective_status || (canIssue(request) ? "ready to issue" : "locked")} /></div>{capability ? <><div className="cg-data-grid cg-data-grid-tight">{[["capability ID", capability.capability_id], ["fingerprint", capability.capability_fingerprint], ["status", capability.effective_status], ["expires", capability.expires_at_utc], ["request binding", capability.request_fingerprint], ["evidence binding", capability.evidence_set_fingerprint], ["result binding", capability.authorization_result_fingerprint], ["nonce hash", capability.presentation_nonce_hash || "empty until consume"]].map(([label, value]) => <DataCell key={label} label={label} value={value} />)}</div><div className="cg-capability-actions"><label className="cg-field"><span>Presentation nonce</span><input value={nonce} onChange={(event) => setNonce(event.target.value)} placeholder="Enter the nonce generated for this presentation" /></label><div className="cg-button-row"><button className="cg-button cg-button-dark" type="button" onClick={onConsume} disabled={busy || !nonce.trim() || !wallet || wrongNetwork || capability.effective_status !== "CAPABILITY_ISSUED"}>Consume capability <KeyRound size={14} /></button><button className="cg-button cg-button-outline" type="button" onClick={onRevoke} disabled={busy || !wallet || wrongNetwork || capability.effective_status !== "CAPABILITY_ISSUED"}>Revoke capability</button></div></div></> : <div className="cg-action-panel"><div><span className="cg-card-kicker">No capability persisted</span><h3>{request.result?.review_status === "AUTHORIZED" ? "Authorization is ready to issue." : "Capability issuance is gated by authorization."}</h3><p>Only an authorized request can produce an access pass.</p></div><button className="cg-button cg-button-dark" type="button" onClick={onIssue} disabled={!canIssue(request) || busy || !wallet || wrongNetwork}>Issue capability <KeyRound size={14} /></button></div>}</section>;
}

function PoliciesPage({ wallet, wrongNetwork, busy, onWrite }: { wallet: WalletConnection | null; wrongNetwork: boolean; busy: boolean; onWrite: (method: string, args: WriteArg[]) => Promise<boolean> }) {
  const [lookup, setLookup] = useState(studioDevConfig.policyId); const [policy, setPolicy] = useState<PolicyRecord | null>(null); const [error, setError] = useState<string | null>(null); const [form, setForm] = useState({ policyId: "", resourceId: "", policyText: "Identity profile access for account verification", version: "v1", expires: futureUtc(30), authorities: DEFAULT_AUTHORITIES, rules: JSON.stringify(DEFAULT_RULES, null, 2), maxAge: "604800" });
  async function inspect(id = lookup) { setError(null); try { setPolicy(await getPolicy(id.trim())); } catch (nextError) { setError(errorMessage(nextError)); } }
  function patch(next: Partial<typeof form>) { setForm((current) => ({ ...current, ...next })); }
  async function register(event: FormEvent) { event.preventDefault(); try { const authorities = JSON.parse(form.authorities); const rules = JSON.parse(form.rules); const id = form.policyId.trim() || makeId("policy"); const ok = await onWrite("register_policy", [id, form.resourceId.trim(), form.policyText.trim(), form.version.trim(), form.expires.trim(), JSON.stringify(authorities), JSON.stringify(rules), Number(form.maxAge)]); if (ok) { setLookup(id); await inspect(id); } } catch (nextError) { setError(errorMessage(nextError)); } }
  async function revoke() { if (!policy) return; const ok = await onWrite("revoke_policy", [policy.policy_id]); if (ok) await inspect(policy.policy_id); }
  return <div className="cg-page cg-policies-page"><PageIntro eyebrow="Policies / Registry" title="Policy is the first gate." detail="Read the live registry, register a new policy, or revoke one when the connected owner is authorized to do so." back="/app" /><div className="cg-policy-layout"><section><div className="cg-section-marker"><span>01</span><span>Inspect existing</span></div><div className="cg-inspect-card"><div className="cg-input-row"><TextInput label="Policy ID" value={lookup} onChange={setLookup} /><button className="cg-button cg-button-outline cg-inspect-button" type="button" onClick={() => void inspect()}>Read policy <RefreshCw size={14} /></button></div>{error ? <InlineError message={error} /> : null}{policy ? <PolicySummary policy={policy} onRevoke={revoke} canRevoke={Boolean(wallet && addressEqual(wallet.address, policy.owner) && !policy.revoked)} busy={busy || wrongNetwork} /> : <p className="cg-form-note">The registry is read-only until you inspect a policy ID.</p>}</div></section><section><div className="cg-section-marker"><span>02</span><span>Register new</span></div><form className="cg-form-card cg-policy-form" onSubmit={register}><div className="cg-input-grid"><TextInput label="Policy ID" value={form.policyId} onChange={(value) => patch({ policyId: value })} placeholder="Generated if blank" /><TextInput label="Resource ID" value={form.resourceId} onChange={(value) => patch({ resourceId: value })} required /><TextInput label="Policy version" value={form.version} onChange={(value) => patch({ version: value })} required /><TextInput label="Expires at (UTC)" value={form.expires} onChange={(value) => patch({ expires: value })} required /><TextInput label="Max evidence age (seconds)" value={form.maxAge} onChange={(value) => patch({ maxAge: value })} required /><TextInput label="Policy text" value={form.policyText} onChange={(value) => patch({ policyText: value })} required /></div><TextArea label="Allowed authorities JSON" value={form.authorities} onChange={(value) => patch({ authorities: value })} /><TextArea label="Nine rules JSON" value={form.rules} onChange={(value) => patch({ rules: value })} /><div className="cg-form-footer"><span className="cg-form-note">Registering requires a connected wallet and finalizes on Studio Dev.</span><button className="cg-button cg-button-dark" type="submit" disabled={busy || !wallet || wrongNetwork}>{busy ? "Submitting…" : "Register policy"}<ArrowRight size={15} /></button></div></form></section></div></div>;
}

function PolicyDetail({ policyId, wallet, wrongNetwork, busy, onWrite }: { policyId: string; wallet: WalletConnection | null; wrongNetwork: boolean; busy: boolean; onWrite: (method: string, args: WriteArg[]) => Promise<boolean> }) {
  const [policy, setPolicy] = useState<PolicyRecord | null>(null); const [error, setError] = useState<string | null>(null); const load = useCallback(async () => { try { setPolicy(await getPolicy(policyId)); setError(null); } catch (nextError) { setError(errorMessage(nextError)); } }, [policyId]); useEffect(() => { const timer = policyId ? window.setTimeout(() => { void load(); }, 0) : undefined; return () => { if (timer) window.clearTimeout(timer); }; }, [load, policyId]); async function revoke() { if (!policy) return; if (await onWrite("revoke_policy", [policy.policy_id])) await load(); }
  if (!policyId) return <EmptyState title="No policy selected" detail="Choose a policy ID from the registry." href="/app/policies" />;
  return <div className="cg-page cg-detail-page"><PageIntro eyebrow="Policies / Record" title={policy ? shortValue(policy.policy_id, 18, 12) : "Loading policy…"} detail="The registered policy and its nine persisted rule dimensions." back="/app/policies" />{error ? <InlineError message={error} /> : null}{policy ? <><div className="cg-record-header"><div><span className="cg-card-kicker">Policy {policy.policy_version}</span><h2>{policy.policy_text}</h2></div><StatusBadge status={policy.revoked ? "REVOKED" : policy.expired ? "EXPIRED" : policy.state} /></div><div className="cg-data-grid">{[["policy ID", policy.policy_id], ["owner", policy.owner], ["resource", policy.resource_id], ["fingerprint", policy.policy_fingerprint], ["expires", policy.expires_at_utc], ["max evidence age", `${policy.max_evidence_age_seconds}s`]].map(([label, value]) => <DataCell key={label} label={label} value={value} />)}</div><div className="cg-rule-list">{policy.rules.map((rule) => <div key={rule.rule_id}><span>{rule.rule_id}</span><div><strong>{rule.dimension}</strong><p>{rule.description}</p></div></div>)}</div><div className="cg-form-footer"><span className="cg-form-note">Revocation is authorized by the policy owner on the deployed contract.</span><button className="cg-button cg-button-outline" type="button" onClick={() => void revoke()} disabled={busy || wrongNetwork || !wallet || !addressEqual(wallet.address, policy.owner) || policy.revoked}>Revoke policy</button></div></> : <LoadingState label="Reading policy from Studio Dev…" />}</div>;
}

function PolicySummary({ policy, onRevoke, canRevoke, busy }: { policy: PolicyRecord; onRevoke: () => void; canRevoke: boolean; busy: boolean }) { return <div className="cg-policy-summary"><div className="cg-record-header"><div><span className="cg-card-kicker">Policy {policy.policy_version}</span><h2>{policy.policy_id}</h2></div><StatusBadge status={policy.revoked ? "REVOKED" : policy.expired ? "EXPIRED" : policy.state} /></div><div className="cg-data-grid">{[["owner", policy.owner], ["resource", policy.resource_id], ["fingerprint", policy.policy_fingerprint], ["expires", policy.expires_at_utc], ["rules", `${policy.rules.length} dimensions`]].map(([label, value]) => <DataCell key={label} label={label} value={value} />)}</div><div className="cg-rule-list">{policy.rules.map((rule) => <div key={rule.rule_id}><span>{rule.rule_id}</span><div><strong>{rule.dimension}</strong><p>{rule.description}</p></div></div>)}</div><div className="cg-button-row"><Link className="cg-button cg-button-dark" href={`/app/policy/${encodeURIComponent(policy.policy_id)}`}>Open policy record <ArrowRight size={14} /></Link><button className="cg-button cg-button-outline" type="button" onClick={onRevoke} disabled={!canRevoke || busy}>Revoke policy</button></div></div>; }

function LiveProof() {
  const [policy, setPolicy] = useState<PolicyRecord | null>(null); const [request, setRequest] = useState<UseRequestRecord | null>(null); const [evidence, setEvidence] = useState<EvidenceSetRecord | null>(null); const [capability, setCapability] = useState<CapabilityRecord | null>(null); const [remote, setRemote] = useState<RemoteEvidenceCheck | undefined>(); const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle"); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setState("loading"); try { const nextPolicy = await getPolicy(studioDevConfig.policyId); const nextRequest = await getUseRequest(studioDevConfig.requestId); const nextEvidence = nextRequest.evidence_set_id ? await getEvidenceSet(nextRequest.evidence_set_id) : null; const nextCapability = nextRequest.capability_id ? await getCapability(nextRequest.capability_id) : null; setPolicy(nextPolicy); setRequest(nextRequest); setEvidence(nextEvidence); setCapability(nextCapability); setRemote(nextEvidence ? await verifyRemoteEvidence(nextEvidence) : undefined); setError(null); setState("ready"); } catch (nextError) { setError(errorMessage(nextError)); setState("error"); } }, []); useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  return <div className="cg-page cg-live-page"><PageIntro eyebrow="Live proof / Studio Dev" title="The tested authorization record." detail="This view reads the authoritative ConsentGate policy, request, evidence set, review result, and capability configured for the Studio Dev happy path." back="/app" /><div className="cg-live-proof-head"><div><span className="cg-card-kicker">Authoritative contract</span><code>{studioDevConfig.contractAddress}</code></div><button className="cg-button cg-button-outline" type="button" onClick={() => void load()} disabled={state === "loading"}><RefreshCw size={14} className={state === "loading" ? "cg-spin" : ""} /> Refresh proof</button></div>{error ? <InlineError message={error} /> : null}{request && policy ? <><div className="cg-proof-status"><div><span className="cg-card-kicker">Current request state</span><strong>{recordState(request)}</strong></div><div><span className="cg-card-kicker">Review decision</span><strong>{String(request.result?.decision || request.result?.review_status || "—")}</strong></div><div><span className="cg-card-kicker">Capability</span><strong>{capability?.effective_status || "—"}</strong></div></div><div className="cg-live-dossier"><div className="cg-live-dossier-title"><SectionMarker number="01" label="Authorization record" /><span>{request.request_id}</span></div><div className="cg-data-grid">{[["policy", policy.policy_id], ["policy fingerprint", policy.policy_fingerprint], ["request fingerprint", request.request_fingerprint], ["evidence set", evidence?.evidence_set_id], ["evidence fingerprint", evidence?.evidence_set_fingerprint], ["result fingerprint", request.result_fingerprint], ["policy owner", policy.owner], ["request recipient", request.recipient]].map(([label, value]) => <DataCell key={label} label={label} value={value} />)}</div>{request.result ? <div className="cg-check-grid cg-live-checks">{RESULT_DIMENSIONS.map(([key, label]) => <div key={key} className={request.result?.[key] === true ? "is-pass" : "is-fail"}><span>{request.result?.[key] === true ? <Check size={13} /> : <X size={13} />}</span><strong>{label}</strong></div>)}</div> : null}<RemoteEvidence remote={remote} evidence={evidence} /></div><div className="cg-proof-actions"><Link className="cg-button cg-button-dark" href={`/app/request/${encodeURIComponent(request.request_id)}`}>Open authorization dossier <ArrowRight size={15} /></Link><Link className="cg-button cg-button-outline" href={`/app/policy/${encodeURIComponent(policy.policy_id)}`}>Inspect policy <ArrowRight size={15} /></Link></div></> : state === "loading" ? <LoadingState label="Reading the live proof from Studio Dev…" /> : <EmptyState title="Live proof unavailable" detail="The configured Studio Dev record could not be read." href="/app" />}</div>;
}

function RemoteEvidence({ remote, evidence }: { remote?: RemoteEvidenceCheck; evidence: EvidenceSetRecord | null }) { if (!evidence) return null; return <div className="cg-remote-evidence"><div><span className="cg-card-kicker">Remote evidence verification</span><strong className={`cg-remote-${remote?.status || "idle"}`}>{remote?.status || "not checked"}</strong></div><div>{remote?.entries.map((entry) => <div className="cg-remote-row" key={entry.evidenceId}><span>{entry.evidenceId}</span><span>source {entry.sourceStatus}</span><span>attestation {entry.attestationStatus}</span></div>)}</div></div>; }
function FormSection({ title, note, children }: { title: string; note: string; children: ReactNode }) { return <fieldset className="cg-form-section"><legend>{title}</legend><p>{note}</p>{children}</fieldset>; }
function TextInput({ label, value, onChange, placeholder, required, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean; type?: string }) { return <label className="cg-field"><span>{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} /></label>; }
function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="cg-field"><span>{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} rows={6} /></label>; }
function SelectInput({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) { return <label className="cg-field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>; }
function DataCell({ label, value }: { label: string; value: string | undefined }) { return <div className="cg-data-cell"><span>{label}</span><strong title={value}>{value || "—"}</strong></div>; }
function ReadbackStrip({ title, items, tone }: { title: string; items: Array<[string, string | undefined]>; tone: string }) { return <div className="cg-readback"><div><span>{title}</span>{items.map(([label, value]) => <strong key={label}>{label}: {value || "—"}</strong>)}</div><StatusBadge status={tone} /></div>; }
function StatusBadge({ status }: { status: string }) { return <span className={`cg-status cg-status-${statusTone(status)}`}><i />{status}</span>; }
function CopyValue({ value }: { value: string | undefined }) { const [copied, setCopied] = useState(false); async function copy() { if (!value) return; await navigator.clipboard?.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1200); } return <button className="cg-copy-value" type="button" onClick={() => void copy()} title="Copy value"><span>{shortValue(value)}</span>{copied ? <Check size={13} /> : <Copy size={13} />}</button>; }
function Notice({ kind, message, onDismiss }: { kind: "error" | "info"; message: string; onDismiss: () => void }) { return <div className={`cg-notice cg-notice-${kind}`}><span>{message}</span><button type="button" onClick={onDismiss} aria-label="Dismiss"><X size={14} /></button></div>; }
function InlineError({ message }: { message: string }) { return <div className="cg-inline-error">{message}</div>; }
function LoadingState({ label }: { label: string }) { return <div className="cg-loading"><LoaderCircle size={19} className="cg-spin" /><span>{label}</span></div>; }
function EmptyState({ title, detail, href }: { title: string; detail: string; href: string }) { return <div className="cg-empty"><LockKeyhole size={22} /><h2>{title}</h2><p>{detail}</p><Link className="cg-button cg-button-outline" href={href}>Return to workspace <ArrowLeft size={14} /></Link></div>; }
function LockedPanel({ title, detail }: { title: string; detail: string }) { return <div className="cg-locked"><LockKeyhole size={19} /><div><strong>{title}</strong><span>{detail}</span></div></div>; }
function TransactionNotice({ progress, onDismiss }: { progress: WriteProgress; onDismiss: () => void }) { return <div className={`cg-transaction cg-transaction-${progress.phase}`}><div><span>{progress.label}</span>{progress.txHash ? <code>{shortValue(progress.txHash, 11, 9)}</code> : null}{progress.error ? <small>{progress.error}</small> : null}</div><button type="button" onClick={onDismiss} aria-label="Dismiss transaction status"><X size={14} /></button></div>; }
