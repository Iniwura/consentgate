import type {
  EvidenceEntry,
  EvidenceSetRecord,
  RemoteEvidenceCheck,
} from "@/lib/types";

async function sha256Hex(body: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", body);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function checkUrl(
  url: string,
  expectedHash: string,
): Promise<"verified" | "unavailable" | "mismatch"> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return "unavailable";
    const actualHash = await sha256Hex(await response.arrayBuffer());
    return actualHash === expectedHash ? "verified" : "mismatch";
  } catch {
    return "unavailable";
  }
}

async function checkEntry(entry: EvidenceEntry) {
  const [sourceStatus, attestationStatus] = await Promise.all([
    checkUrl(entry.source_url, entry.content_sha256),
    checkUrl(entry.attestation_url, entry.attestation_hash),
  ]);
  return {
    evidenceId: entry.evidence_id,
    sourceStatus,
    attestationStatus,
    sourceUrl: entry.source_url,
    attestationUrl: entry.attestation_url,
  };
}

export async function verifyRemoteEvidence(
  evidenceSet: EvidenceSetRecord,
): Promise<RemoteEvidenceCheck> {
  const entries = await Promise.all(
    evidenceSet.manifest.entries.map((entry) => checkEntry(entry)),
  );
  const allVerified = entries.every(
    (entry) =>
      entry.sourceStatus === "verified" &&
      entry.attestationStatus === "verified",
  );
  const hasMismatch = entries.some(
    (entry) =>
      entry.sourceStatus === "mismatch" ||
      entry.attestationStatus === "mismatch",
  );

  return {
    status: allVerified ? "verified" : hasMismatch ? "mismatch" : "unavailable",
    checkedAt: new Date().toISOString(),
    entries,
  };
}

export function evidenceEntryCount(evidenceSet: EvidenceSetRecord | null) {
  return evidenceSet?.manifest.entries.length ?? 0;
}
