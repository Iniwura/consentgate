import type { Address } from "viem";

const DEFAULTS = {
  rpcUrl: "https://studio-dev.genlayer.com/api",
  chainId: 61997,
  contractAddress: "0xF12088c0feaF760c6Bc8F3E5A5a445A82ae08eEc",
  policyId: "cgfinal20260919201751c31ce658b75a",
  requestId: "cghappy20260919201751c31ce658b75a",
  consensusMain:
    "0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575" as Address,
} as const;

function nonEmptyEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value || fallback;
}

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function envAddress(name: string, fallback: Address): Address {
  const value = process.env[name]?.trim();
  return value && /^0x[a-fA-F0-9]{40}$/.test(value)
    ? (value as Address)
    : fallback;
}

export const studioDevConfig = {
  networkName: "GenLayer Studio Devnet",
  networkAlias: "studio-dev",
  rpcUrl: nonEmptyEnv("NEXT_PUBLIC_GENLAYER_RPC", DEFAULTS.rpcUrl),
  chainId: envNumber("NEXT_PUBLIC_GENLAYER_CHAIN_ID", DEFAULTS.chainId),
  contractAddress: envAddress(
    "NEXT_PUBLIC_CONTRACT_ADDRESS",
    DEFAULTS.contractAddress as Address,
  ),
  policyId: nonEmptyEnv("NEXT_PUBLIC_DEMO_POLICY_ID", DEFAULTS.policyId),
  requestId: nonEmptyEnv("NEXT_PUBLIC_DEMO_REQUEST_ID", DEFAULTS.requestId),
  consensusMain: DEFAULTS.consensusMain,
  explorerUrl: "https://genlayer-explorer.vercel.app",
} as const;

export const walletChainParams = {
  chainId: `0x${studioDevConfig.chainId.toString(16)}`,
  chainName: studioDevConfig.networkName,
  nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
  rpcUrls: [studioDevConfig.rpcUrl],
  blockExplorerUrls: [studioDevConfig.explorerUrl],
} as const;
