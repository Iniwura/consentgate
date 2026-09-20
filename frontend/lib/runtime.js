export const REVIEWABLE_STATES = ["USE_REQUEST_FROZEN", "REVIEW_RETRY_REQUIRED"];

export function canReviewState(state) {
  return REVIEWABLE_STATES.includes(state ?? "");
}

export function canRepairState(state) {
  return state === "EVIDENCE_REPAIR_REQUIRED";
}

export function evidenceVersion(value) {
  return value.trim() || "v1";
}

export function versionedEvidence(value) {
  const version = evidenceVersion(value);
  return { evidence_version: version, entry_version: version };
}

export function canonicalUtcSecond(value) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("UTC timestamp is required.");
  const hasZone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(trimmed);
  const withZone = hasZone
    ? trimmed
    : `${trimmed}${trimmed.length === 16 ? ":00" : ""}Z`;
  const parsed = new Date(withZone);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid UTC timestamp: ${value}`);
  }
  return parsed.toISOString().replace(".000Z", "Z");
}

export function utcInputValue(value) {
  const parsed = new Date(canonicalUtcSecond(value));
  const pad = (part) => String(part).padStart(2, "0");
  return `${parsed.getUTCFullYear()}-${pad(parsed.getUTCMonth() + 1)}-${pad(parsed.getUTCDate())}T${pad(parsed.getUTCHours())}:${pad(parsed.getUTCMinutes())}`;
}

export function capabilityCanConsume(status) {
  return status === "CAPABILITY_ISSUED";
}

export function isIssueCapabilityConfirmation(method, capabilityId, state) {
  return (
    method === "issue_capability" &&
    typeof capabilityId === "string" &&
    capabilityId.trim() !== "" &&
    state === "CAPABILITY_ISSUED"
  );
}

export function isFinishedWithReturn(successful, executionResultName) {
  return successful === true && executionResultName === "FINISHED_WITH_RETURN";
}

export function isAcceptedWithReturn(statusName, successful, executionResultName) {
  return (
    (statusName === "ACCEPTED" || statusName === "FINALIZED") &&
    isFinishedWithReturn(successful, executionResultName)
  );
}

export function canCompleteAfterStateConfirmation({
  accepted,
  executionSucceeded,
  stateConfirmed,
}) {
  return accepted === true && executionSucceeded === true && stateConfirmed === true;
}

export function submittedFailureLabel(hasTransactionHash) {
  return hasTransactionHash
    ? "TRANSACTION SUBMITTED — CHECK STATUS"
    : "TRANSACTION DID NOT COMPLETE";
}

export function shouldResubmitAfterHash() {
  return false;
}

const PRODUCT_STATE_LABELS = {
  AUTHORIZED: "ACCESS APPROVED",
  DENIED: "ACCESS DENIED",
  EVIDENCE_REPAIR_REQUIRED: "CONSENT PROOF NEEDS UPDATE",
  REVIEW_RETRY_REQUIRED: "PERMISSION CHECK NEEDS RETRY",
  USE_REQUEST_OPEN: "REQUEST OPEN",
  USE_REQUEST_FROZEN: "CONSENT LOCKED",
  CAPABILITY_ISSUED: "ACCESS PASS READY",
  CAPABILITY_CONSUMED: "ACCESS USED",
  REVOKED: "ACCESS REVOKED",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED",
};

export function productStateLabel(state) {
  return PRODUCT_STATE_LABELS[state] || state;
}

export function walletStateFor(address, chainId, expectedChainId) {
  if (!address) return "disconnected";
  return chainId === expectedChainId ? "connected" : "wrong-network";
}
