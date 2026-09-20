import type { Account, Address } from "viem";
import { isSuccessful } from "genlayer-js";
import { TransactionHashVariant, TransactionStatus } from "genlayer-js/types";

import { studioDevConfig, walletChainParams } from "@/lib/config";
import {
  getReadClient,
  getWriteClient,
} from "@/lib/genlayer";
import {
  isAcceptedWithReturn,
  submittedFailureLabel,
} from "@/lib/runtime";
import type {
  Eip1193Provider,
  CapabilityRecord,
  EvidenceSetRecord,
  LiveSnapshot,
  PolicyRecord,
  UseRequestRecord,
  WalletConnection,
  WriteProgress,
} from "@/lib/types";

const contractAddress = studioDevConfig.contractAddress as Address;
const LATEST_NONFINAL = TransactionHashVariant.LATEST_NONFINAL;

function walletAccount(address: Address): Account {
  return { address, type: "json-rpc" };
}

function parseJson<T>(value: unknown, label: string): T {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      throw new Error(`${label} returned invalid JSON: ${String(error)}`);
    }
  }
  if (value && typeof value === "object") return value as T;
  throw new Error(`${label} returned an empty value.`);
}

export class WriteTransactionError extends Error {
  transactionHash?: string;
  functionName?: string;
  args?: WriteArguments;

  constructor(
    message: string,
    transactionHash?: string,
    functionName?: string,
    args?: WriteArguments,
  ) {
    super(message);
    this.name = "WriteTransactionError";
    this.transactionHash = transactionHash;
    this.functionName = functionName;
    this.args = args;
  }
}

async function readJson<T>(functionName: string, args: string[]): Promise<T> {
  const result = await getReadClient().readContract({
    address: contractAddress,
    functionName,
    args,
    jsonSafeReturn: true,
    transactionHashVariant: LATEST_NONFINAL,
  });
  return parseJson<T>(result, functionName);
}

export async function getPolicy(policyId = studioDevConfig.policyId) {
  return readJson<PolicyRecord>("get_policy", [policyId]);
}

export async function getUseRequest(
  requestId = studioDevConfig.requestId,
) {
  return readJson<UseRequestRecord>("get_use_request", [requestId]);
}

export async function getEvidenceSet(evidenceSetId: string) {
  return readJson<EvidenceSetRecord>("get_evidence_set", [evidenceSetId]);
}

export async function getCapability(capabilityId: string) {
  return readJson<CapabilityRecord>("get_capability", [capabilityId]);
}

export async function getLiveSnapshot(): Promise<LiveSnapshot> {
  const policy = await getPolicy();
  const request = await getUseRequest();
  const evidenceSet = request.evidence_set_id
    ? await getEvidenceSet(request.evidence_set_id)
    : null;
  const capability = request.capability_id
    ? await getCapability(request.capability_id)
    : null;

  return {
    policy,
    request,
    evidenceSet,
    capability,
    readAt: new Date().toISOString(),
  };
}

export function getBrowserProvider(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  const provider = (window as Window & { ethereum?: Eip1193Provider }).ethereum;
  return provider ?? null;
}

function parseChainId(value: unknown): number | null {
  if (typeof value === "number") return Number.isInteger(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = value.startsWith("0x")
    ? Number.parseInt(value, 16)
    : Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

export async function readWalletConnection(
  provider: Eip1193Provider,
): Promise<WalletConnection | null> {
  const accounts = await provider.request({ method: "eth_accounts" });
  const address = Array.isArray(accounts) && typeof accounts[0] === "string"
    ? accounts[0]
    : null;
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) return null;

  const chainId = parseChainId(
    await provider.request({ method: "eth_chainId" }),
  );
  return {
    address: address as `0x${string}`,
    chainId,
    provider,
  };
}

export async function connectWallet(): Promise<WalletConnection> {
  const provider = getBrowserProvider();
  if (!provider) {
    throw new Error("No EIP-1193 wallet was detected in this browser.");
  }

  const accounts = await provider.request({ method: "eth_requestAccounts" });
  const address = Array.isArray(accounts) && typeof accounts[0] === "string"
    ? accounts[0]
    : null;
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error("The wallet did not return a usable account address.");
  }

  const chainId = parseChainId(
    await provider.request({ method: "eth_chainId" }),
  );
  return { address: address as `0x${string}`, chainId, provider };
}

export async function switchToStudioDev(provider: Eip1193Provider) {
  let needsExplicitSwitch = false;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: walletChainParams.chainId }],
    });
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? (error as { code?: number }).code
        : undefined;
    if (code !== 4902) throw error;

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [walletChainParams],
    });
    needsExplicitSwitch = true;
  }

  if (needsExplicitSwitch) {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: walletChainParams.chainId }],
    });
  }

  const verifiedChainId = parseChainId(
    await provider.request({ method: "eth_chainId" }),
  );
  if (verifiedChainId !== studioDevConfig.chainId) {
    throw new Error(
      `Wallet remained on chain ${verifiedChainId ?? "unknown"}; Studio Dev is ${studioDevConfig.chainId}.`,
    );
  }
}

export type WriteArguments = Array<string | boolean | number | bigint>;

export async function simulateWrite(
  functionName: string,
  args: WriteArguments,
  wallet: WalletConnection,
) {
  const client = getWriteClient(wallet.address as Address, wallet.provider);
  return client.simulateWriteContract({
    account: walletAccount(wallet.address as Address),
    address: contractAddress,
    functionName,
    args,
    transactionHashVariant: LATEST_NONFINAL,
  });
}

function stateOf(record: { state?: string; effective_state?: string }) {
  return record.effective_state || record.state || "";
}

export async function confirmExpectedContractState(
  functionName: string,
  args: WriteArguments,
) {
  const id = String(args[0] ?? "");
  if (functionName === "register_policy" || functionName === "revoke_policy" || functionName === "expire_policy") {
    const policy = await getPolicy(id);
    const expected = functionName === "register_policy"
      ? "POLICY_REGISTERED"
      : functionName === "revoke_policy"
        ? "POLICY_REVOKED"
        : "EXPIRED";
    if (policy.state !== expected && !(functionName === "expire_policy" && policy.expired)) {
      throw new Error(`State confirmation failed: expected ${expected}, read ${policy.state}.`);
    }
    return policy.state;
  }

  if (["create_use_request", "freeze_use_request", "repair_evidence", "review_use", "cancel_use_request", "expire_use_request", "issue_capability"].includes(functionName)) {
    const request = await getUseRequest(id);
    if (functionName === "create_use_request" && stateOf(request) !== "USE_REQUEST_OPEN") {
      throw new Error(`State confirmation failed: expected USE_REQUEST_OPEN, read ${stateOf(request)}.`);
    }
    if (["freeze_use_request", "repair_evidence"].includes(functionName) && stateOf(request) !== "USE_REQUEST_FROZEN") {
      throw new Error(`State confirmation failed: expected USE_REQUEST_FROZEN, read ${stateOf(request)}.`);
    }
    if (functionName === "review_use") {
      const reviewState = stateOf(request);
      if (!["AUTHORIZED", "DENIED", "EVIDENCE_REPAIR_REQUIRED", "REVIEW_RETRY_REQUIRED"].includes(reviewState) || !request.result) {
        throw new Error(`State confirmation failed: review result is not persisted in ${reviewState || "unknown"}.`);
      }
    }
    if (functionName === "cancel_use_request" && stateOf(request) !== "CANCELLED") {
      throw new Error(`State confirmation failed: expected CANCELLED, read ${stateOf(request)}.`);
    }
    if (functionName === "expire_use_request" && stateOf(request) !== "EXPIRED") {
      throw new Error(`State confirmation failed: expected EXPIRED, read ${stateOf(request)}.`);
    }
    if (functionName === "issue_capability" && (stateOf(request) !== "AUTHORIZED" || !request.capability_id)) {
      throw new Error(`State confirmation failed: expected an authorized request with a capability, read ${stateOf(request)}.`);
    }
    return stateOf(request);
  }

  if (["consume_capability", "revoke_capability", "expire_capability"].includes(functionName)) {
    const capability = await getCapability(id);
    const expected = functionName === "consume_capability"
      ? "CAPABILITY_CONSUMED"
      : functionName === "revoke_capability"
        ? "REVOKED"
        : "EXPIRED";
    if (capability.effective_status !== expected && capability.stored_status !== expected) {
      throw new Error(`State confirmation failed: expected ${expected}, read ${capability.effective_status}.`);
    }
    return capability.effective_status;
  }

  throw new Error(`State confirmation is not configured for ${functionName}.`);
}

export async function confirmSubmittedWrite(
  functionName: string,
  args: WriteArguments,
  wallet: WalletConnection,
  transactionHash: `0x${string}`,
  onProgress?: (progress: WriteProgress) => void,
) {
  const client = getWriteClient(wallet.address as Address, wallet.provider);
  onProgress?.({
    phase: "consensus",
    label: "CONSENSUS IN PROGRESS",
    txHash: transactionHash,
  });
  const receipt = await client.waitForDecision({
    hash: transactionHash as `0x${string}` & { length: 66 },
    interval: 3000,
  });
  const statusName = receipt.statusName;
  const executionSucceeded = isAcceptedWithReturn(
    statusName,
    isSuccessful(receipt),
    receipt.txExecutionResultName,
  );
  if (statusName !== TransactionStatus.ACCEPTED && statusName !== TransactionStatus.FINALIZED) {
    throw new Error(`Consensus did not reach ACCEPTED: ${String(statusName ?? "unknown")}.`);
  }
  if (!executionSucceeded) {
    throw new Error(
      `Accepted transaction did not finish with a return: ${String(receipt.txExecutionResultName ?? "unknown")}.`,
    );
  }
  onProgress?.({
    phase: "accepted",
    label: "ACCEPTED",
    txHash: transactionHash,
    statusName: String(statusName),
  });
  onProgress?.({
    phase: "confirming-state",
    label: "CONFIRMING STATE",
    txHash: transactionHash,
  });
  const confirmedState = await confirmExpectedContractState(functionName, args);
  onProgress?.({
    phase: "complete",
    label: "COMPLETE",
    txHash: transactionHash,
    statusName: String(statusName),
  });
  return { hash: transactionHash, receipt, confirmedState };
}

export async function submitWrite(
  functionName: string,
  args: WriteArguments,
  wallet: WalletConnection,
  onProgress?: (progress: WriteProgress) => void,
) {
  const client = getWriteClient(wallet.address as Address, wallet.provider);
  const account = walletAccount(wallet.address as Address);
  let hash: `0x${string}` | undefined;
  try {
    onProgress?.({ phase: "simulating", label: "Simulating against Studio Dev" });
    const feeEstimate = await client.estimateTransactionFeesForWrite({
      account,
      address: contractAddress,
      functionName,
      args,
      value: 0n,
      transactionHashVariant: LATEST_NONFINAL,
    });
    await client.simulateWriteContract({
      account,
      address: contractAddress,
      functionName,
      args,
      value: 0n,
      fees: {
        distribution: feeEstimate.distribution,
        messageAllocations: feeEstimate.messageAllocations,
        feeValue: feeEstimate.feeValue,
      },
      transactionHashVariant: LATEST_NONFINAL,
    });

    onProgress?.({ phase: "awaiting-wallet", label: "Awaiting wallet approval" });
    const submittedHash = await client.writeContract({
      account,
      address: contractAddress,
      functionName,
      args,
      value: 0n,
      fees: {
        distribution: feeEstimate.distribution,
        messageAllocations: feeEstimate.messageAllocations,
        feeValue: feeEstimate.feeValue,
      },
    });
    hash = submittedHash;

    onProgress?.({
      phase: "submitted",
      label: "SUBMITTED",
      txHash: hash,
    });
    return await confirmSubmittedWrite(functionName, args, wallet, submittedHash, onProgress);
  } catch (error) {
    if (hash) {
      const message = error instanceof Error ? error.message : String(error);
      onProgress?.({
        phase: "failed",
        label: submittedFailureLabel(true),
        txHash: hash,
        error: message,
      });
      throw new WriteTransactionError(message, hash, functionName, args);
    }
    throw error;
  }
}

export const contractMethods = {
  register_policy: ["policy_id", "resource_id", "policy_text", "policy_version", "expires_at_utc", "allowed_authorities_json", "rules_json", "max_evidence_age_seconds"],
  revoke_policy: ["policy_id"],
  expire_policy: ["policy_id"],
  create_use_request: ["request_id", "policy_id", "resource_id", "purpose", "data_category", "recipient", "request_expires_at_utc", "retention_until_utc", "sharing_mode", "commercial_use", "replay_nonce"],
  freeze_use_request: ["request_id", "evidence_version", "manifest_json"],
  repair_evidence: ["request_id", "evidence_version", "manifest_json"],
  review_use: ["request_id"],
  cancel_use_request: ["request_id"],
  expire_use_request: ["request_id"],
  issue_capability: ["request_id"],
  consume_capability: ["capability_id", "presentation_nonce", "resource_id", "purpose", "recipient", "sharing_mode", "commercial_use"],
  revoke_capability: ["capability_id"],
  expire_capability: ["capability_id"],
  get_policy: ["policy_id"],
  get_use_request: ["request_id"],
  get_evidence_set: ["evidence_set_id"],
  get_capability: ["capability_id"],
} as const;
