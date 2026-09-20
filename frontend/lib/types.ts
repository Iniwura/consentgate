export type Authority = {
  authority_id: string;
  authority_key_id: string;
  origin: string;
  attestation_path_prefix: string;
};

export type PolicyRule = {
  rule_id: string;
  dimension: string;
  description: string;
};

export type PolicyRecord = {
  policy_id: string;
  owner: string;
  resource_id: string;
  policy_text: string;
  policy_version: string;
  expires_at_utc: string;
  allowed_authorities: Authority[];
  rules: PolicyRule[];
  max_evidence_age_seconds: number;
  policy_fingerprint: string;
  revoked: boolean;
  expired: boolean;
  state: string;
};

export type UseRequestRecord = {
  request_id: string;
  policy_id: string;
  policy_fingerprint: string;
  requester: string;
  resource_id: string;
  purpose: string;
  data_category: string;
  recipient: string;
  request_expires_at_utc: string;
  retention_until_utc: string;
  sharing_mode: string;
  commercial_use: boolean;
  request_fingerprint: string;
  state: string;
  effective_state: string;
  evidence_set_id: string;
  evidence_set_fingerprint: string;
  capability_id: string;
  result: Record<string, unknown> | null;
  result_fingerprint: string;
  review_attempts: number;
};

export type EvidenceEntry = {
  evidence_id: string;
  evidence_kind: string;
  authority_id: string;
  source_url: string;
  attestation_url: string;
  version: string;
  content_sha256: string;
  issued_at_utc: string;
  expires_at_utc: string;
  attestation_hash: string;
  required: boolean;
};

export type EvidenceManifest = {
  schema_version: string;
  policy_id: string;
  policy_fingerprint: string;
  request_id: string;
  request_fingerprint: string;
  resource_id: string;
  evidence_version: string;
  entries: EvidenceEntry[];
};

export type EvidenceSetRecord = {
  evidence_set_id: string;
  policy_id: string;
  policy_fingerprint: string;
  request_id: string;
  request_fingerprint: string;
  resource_id: string;
  evidence_version: string;
  manifest: EvidenceManifest;
  evidence_set_fingerprint: string;
  replay_keys: string[];
  consumed: boolean;
  superseded: boolean;
};

export type CapabilityRecord = {
  capability_id: string;
  request_id: string;
  policy_id: string;
  issued_to: string;
  resource_id: string;
  policy_fingerprint: string;
  request_fingerprint: string;
  evidence_set_fingerprint: string;
  authorization_result_fingerprint: string;
  purpose: string;
  data_category: string;
  recipient: string;
  retention_until_utc: string;
  sharing_mode: string;
  commercial_use: boolean;
  issued_at_utc: string;
  expires_at_utc: string;
  capability_fingerprint: string;
  stored_status: string;
  effective_status: string;
  presentation_nonce_hash: string;
};

export type LiveSnapshot = {
  policy: PolicyRecord;
  request: UseRequestRecord;
  evidenceSet: EvidenceSetRecord | null;
  capability?: CapabilityRecord | null;
  readAt: string;
};

export type RemoteVerificationStatus =
  | "idle"
  | "checking"
  | "verified"
  | "unavailable"
  | "mismatch";

export type RemoteEvidenceCheck = {
  status: RemoteVerificationStatus;
  checkedAt: string | null;
  entries: Array<{
    evidenceId: string;
    sourceStatus: "verified" | "unavailable" | "mismatch";
    attestationStatus: "verified" | "unavailable" | "mismatch";
    sourceUrl: string;
    attestationUrl: string;
    error?: string;
  }>;
};

export type WalletConnection = {
  address: `0x${string}`;
  chainId: number | null;
  provider: Eip1193Provider;
};

export type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => unknown;
  removeListener?: (
    event: string,
    listener: (...args: unknown[]) => void,
  ) => unknown;
};

export type WritePhase =
  | "idle"
  | "simulating"
  | "awaiting-wallet"
  | "submitted"
  | "consensus"
  | "accepted"
  | "confirming-state"
  | "complete"
  | "failed";

export type WriteProgress = {
  phase: WritePhase;
  label: string;
  txHash?: string;
  error?: string;
  statusName?: string;
};
