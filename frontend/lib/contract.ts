import type { Account, Address } from "viem";
import { isSuccessful } from "genlayer-js";
import { TransactionHashVariant } from "genlayer-js/types";

import { studioDevConfig, walletChainParams } from "@/lib/config";
import {
  getReadClient,
  getWriteClient,
} from "@/lib/genlayer";
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
const FINISHED_WITH_RETURN = "FINISHED_WITH_RETURN" as const;

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
  if (typeof value !== "string") return null;
  const parsed = Number.parseInt(value, 16);
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
  }
}

type WriteArguments = Array<string | boolean | number | bigint>;

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

export async function submitWrite(
  functionName: string,
  args: WriteArguments,
  wallet: WalletConnection,
  onProgress?: (progress: WriteProgress) => void,
) {
  const client = getWriteClient(wallet.address as Address, wallet.provider);
  const account = walletAccount(wallet.address as Address);
  onProgress?.({ phase: "simulating", label: "Simulating against Studio Dev" });
  const feeEstimate = await client.estimateTransactionFeesForWrite({
    account,
    address: contractAddress,
    functionName,
    args,
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
  });

  onProgress?.({ phase: "awaiting-wallet", label: "Awaiting wallet approval" });
  const hash = await client.writeContract({
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

  onProgress?.({
    phase: "finalizing",
    label: "Waiting for finalized consensus",
    txHash: hash,
  });
  const receipt = await client.waitForFinalization({
    hash,
    interval: 3000,
  });

  if (!isSuccessful(receipt) || receipt.txExecutionResultName !== FINISHED_WITH_RETURN) {
    throw new Error(
      `Transaction finalized without a successful return: ${String(receipt.txExecutionResultName ?? "unknown")}`,
    );
  }

  onProgress?.({
    phase: "complete",
    label: "Finalized with return",
    txHash: hash,
  });
  return { hash, receipt };
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
