#!/usr/bin/env python3
"""Generate and validate the one fresh ConsentGate evidence pair.

The bytes are canonical UTF-8 JSON: sorted keys, compact separators, and no
trailing newline. Existing evidence files are never overwritten.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "artifacts" / "STUDIO_DEV_HAPPY_PATH_FIXTURE.json"
EVIDENCE_DIR = ROOT / "evidence"
POLICY_ID = "cgfinal20260919201751c31ce658b75a"
POLICY_FINGERPRINT = "a56672029da0aea54ded8c0d39531b825db813e1f65f3f2f1f09084644e65d1d"
REQUEST_ID = "cghappy20260919201751c31ce658b75a"
REQUEST_FINGERPRINT = "93f6744524393764d85a92c70303dcc64c97f26bba13738a80bcaaf0539ab622"
RESOURCE_ID = "profile20260919201751c31ce658b75a"
REQUESTER = "0xA35dc047f9937BF668743efBDF8Ea93B31A55888"
RETENTION_UNTIL = "2026-09-20T08:17:51Z"
POLICY_EXPIRY = "2026-09-26T20:17:51Z"
AUTHORITY_ID = "demoauthority"
AUTHORITY_KEY_ID = "demokeyv1"
BASE_URL = "https://raw.githubusercontent.com/Iniwura/consentgate/main/evidence/"


def canonical(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).replace(microsecond=0).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )


def parse_utc(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    assert parsed.tzinfo is not None
    assert parsed.isoformat(timespec="seconds").replace("+00:00", "Z") == value
    return parsed


def canonical_bytes(value: dict[str, Any]) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode(
        "utf-8"
    )


def main() -> int:
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    assert fixture["policy_id"] == POLICY_ID
    assert fixture["request_id"] == REQUEST_ID
    assert fixture["resource_id"] == RESOURCE_ID
    assert fixture["policy_fingerprint"] == POLICY_FINGERPRINT
    assert fixture["request_args"][6] == "2026-09-20T20:17:51Z"
    assert fixture["request_args"][7] == RETENTION_UNTIL

    now = datetime.now(timezone.utc).replace(microsecond=0)
    issued_at = canonical(now)
    expires_at = RETENTION_UNTIL
    assert parse_utc(issued_at) <= now
    assert parse_utc(issued_at) < parse_utc(expires_at)
    assert parse_utc(expires_at) <= parse_utc(fixture["request_args"][6])
    assert parse_utc(expires_at) <= parse_utc(POLICY_EXPIRY)

    evidence_id = f"consent-record-{REQUEST_ID}"
    consent_file = f"{REQUEST_ID}-consent.json"
    attestation_file = f"{REQUEST_ID}-attestation.json"
    consent_path = EVIDENCE_DIR / consent_file
    attestation_path = EVIDENCE_DIR / attestation_file
    if consent_path.exists() or attestation_path.exists():
        raise RuntimeError("refusing to overwrite an existing fresh evidence file")

    consent = {
        "authority_id": AUTHORITY_ID,
        "authority_key_id": AUTHORITY_KEY_ID,
        "commercial_use": False,
        "consent": "granted",
        "data_category": "identity profile",
        "evidence_id": evidence_id,
        "evidence_kind": "consent-record",
        "expires_at_utc": expires_at,
        "issued_at_utc": issued_at,
        "policy_fingerprint": POLICY_FINGERPRINT,
        "policy_id": POLICY_ID,
        "purpose": "account access verification",
        "recipient": "ConsentGate Demo App",
        "request_fingerprint": REQUEST_FINGERPRINT,
        "request_id": REQUEST_ID,
        "requester": REQUESTER,
        "resource_id": RESOURCE_ID,
        "retention_until_utc": RETENTION_UNTIL,
        "sharing_mode": "NONE",
        "version": "v1",
    }
    consent_bytes = canonical_bytes(consent)
    consent_hash = hashlib.sha256(consent_bytes).hexdigest()
    attestation = {
        "schema_version": "consentgate.attestation.v1",
        "authority_id": AUTHORITY_ID,
        "authority_key_id": AUTHORITY_KEY_ID,
        "evidence_id": evidence_id,
        "evidence_kind": "consent-record",
        "version": "v1",
        "policy_id": POLICY_ID,
        "policy_fingerprint": POLICY_FINGERPRINT,
        "request_id": REQUEST_ID,
        "request_fingerprint": REQUEST_FINGERPRINT,
        "resource_id": RESOURCE_ID,
        "content_sha256": consent_hash,
        "issued_at_utc": issued_at,
        "expires_at_utc": expires_at,
    }
    attestation_bytes = canonical_bytes(attestation)
    attestation_hash = hashlib.sha256(attestation_bytes).hexdigest()

    assert set(consent) == {
        "authority_id", "authority_key_id", "commercial_use", "consent",
        "data_category", "evidence_id", "evidence_kind", "expires_at_utc",
        "issued_at_utc", "policy_fingerprint", "policy_id", "purpose",
        "recipient", "request_fingerprint", "request_id", "requester",
        "resource_id", "retention_until_utc", "sharing_mode", "version",
    }
    assert set(attestation) == {
        "schema_version", "authority_id", "authority_key_id", "evidence_id",
        "evidence_kind", "version", "policy_id", "policy_fingerprint",
        "request_id", "request_fingerprint", "resource_id", "content_sha256",
        "issued_at_utc", "expires_at_utc",
    }
    assert hashlib.sha256(consent_bytes).hexdigest() == consent_hash
    assert hashlib.sha256(attestation_bytes).hexdigest() == attestation_hash
    assert json.loads(consent_bytes.decode("utf-8")) == consent
    assert json.loads(attestation_bytes.decode("utf-8")) == attestation

    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    consent_path.write_bytes(consent_bytes)
    attestation_path.write_bytes(attestation_bytes)

    fixture["evidence"] = {
        "body_file": consent_file,
        "attestation_file": attestation_file,
        "evidence_id": evidence_id,
        "issued_at_utc": issued_at,
        "expires_at_utc": expires_at,
        "content_sha256": consent_hash,
        "attestation_hash": attestation_hash,
        "content_schema": "consent-record.v1",
        "attestation_schema": "consentgate.attestation.v1",
        "local_validation": "PASS",
        "remote_verified": False,
    }
    fixture["request_result"] = {
        "request_id": REQUEST_ID,
        "requester": REQUESTER,
        "policy_id": POLICY_ID,
        "resource_id": RESOURCE_ID,
        "purpose": "account access verification",
        "data_category": "identity profile",
        "recipient": "ConsentGate Demo App",
        "request_expires_at_utc": "2026-09-20T20:17:51Z",
        "retention_until_utc": RETENTION_UNTIL,
        "sharing_mode": "NONE",
        "commercial_use": False,
        "policy_fingerprint": POLICY_FINGERPRINT,
        "request_fingerprint": REQUEST_FINGERPRINT,
        "evidence_set_id": "",
        "evidence_set_fingerprint": "",
        "state": "USE_REQUEST_OPEN",
        "effective_state": "USE_REQUEST_OPEN",
        "review_attempts": 0,
        "result": None,
        "result_fingerprint": "",
        "capability_id": "",
    }
    fixture["evidence_local_validation"] = "PASS"
    fixture["evidence_remote_verified"] = False
    FIXTURE.write_text(json.dumps(fixture, indent=2) + "\n", encoding="utf-8")

    print(f"CONSENT_FILE={consent_path}")
    print(f"CONSENT_SHA256={consent_hash}")
    print(f"ATTESTATION_FILE={attestation_path}")
    print(f"ATTESTATION_SHA256={attestation_hash}")
    print(f"ISSUED_AT_UTC={issued_at}")
    print(f"EXPIRES_AT_UTC={expires_at}")
    print("LOCAL_EVIDENCE_VALIDATION=PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
