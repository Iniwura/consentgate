#!/usr/bin/env python3
"""Verify published evidence, build the exact freeze manifest, and simulate freeze."""

from __future__ import annotations

import hashlib
import json
import shlex
import sys
from pathlib import Path
from urllib.request import Request, urlopen
from typing import Any

import studio_live_test as live


ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "artifacts" / "STUDIO_DEV_HAPPY_PATH_FIXTURE.json"
CONTRACT = "0xF12088c0feaF760c6Bc8F3E5A5a445A82ae08eEc"
RPC = "https://studio-dev.genlayer.com/api"
POLICY_ID = "cgfinal20260919201751c31ce658b75a"
POLICY_FINGERPRINT = "a56672029da0aea54ded8c0d39531b825db813e1f65f3f2f1f09084644e65d1d"
REQUEST_ID = "cghappy20260919201751c31ce658b75a"
REQUEST_FINGERPRINT = "93f6744524393764d85a92c70303dcc64c97f26bba13738a80bcaaf0539ab622"
RESOURCE_ID = "profile20260919201751c31ce658b75a"
BASE_URL = "https://raw.githubusercontent.com/Iniwura/consentgate/main/evidence/"


def save(fixture: dict[str, Any]) -> None:
    FIXTURE.write_text(json.dumps(fixture, indent=2) + "\n", encoding="utf-8")


def remote_bytes(url: str) -> tuple[int, bytes]:
    request = Request(url, headers={"Cache-Control": "no-cache"})
    with urlopen(request, timeout=30) as response:
        return response.status, response.read()


def manual_command(fixture: dict[str, Any], manifest: str) -> str:
    command = live.argv(
        "write", "freeze_use_request", [REQUEST_ID, "v1", manifest]
    )
    env = live.cli_environment(fixture, (manifest, None))
    prefix = [
        f"DBUS_SESSION_BUS_ADDRESS={env['DBUS_SESSION_BUS_ADDRESS']}",
        f"NODE_OPTIONS={env['NODE_OPTIONS']}",
        f"CG_RAW_ARG_1={env['CG_RAW_ARG_1']}",
    ]
    return shlex.join(prefix + command)


def main() -> int:
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    assert fixture["contract"] == CONTRACT
    assert fixture["policy_id"] == POLICY_ID
    assert fixture["request_id"] == REQUEST_ID
    assert fixture["resource_id"] == RESOURCE_ID
    assert fixture["policy_fingerprint"] == POLICY_FINGERPRINT
    assert fixture["request_result"]["request_fingerprint"] == REQUEST_FINGERPRINT
    evidence = fixture["evidence"]
    body_path = ROOT / "evidence" / evidence["body_file"]
    attestation_path = ROOT / "evidence" / evidence["attestation_file"]
    body_url = BASE_URL + body_path.name
    attestation_url = BASE_URL + attestation_path.name

    checks = []
    for path, url, expected_hash in (
        (body_path, body_url, evidence["content_sha256"]),
        (attestation_path, attestation_url, evidence["attestation_hash"]),
    ):
        status, body = remote_bytes(url)
        local = path.read_bytes()
        remote_hash = hashlib.sha256(body).hexdigest()
        if status != 200 or body != local or remote_hash != expected_hash:
            raise RuntimeError(f"remote verification failed for {path.name}")
        checks.append({"url": url, "http": status, "sha256": remote_hash})

    entry = {
        "evidence_id": evidence["evidence_id"],
        "evidence_kind": "consent-record",
        "authority_id": "demoauthority",
        "source_url": body_url,
        "version": "v1",
        "content_sha256": evidence["content_sha256"],
        "issued_at_utc": evidence["issued_at_utc"],
        "expires_at_utc": evidence["expires_at_utc"],
        "attestation_hash": evidence["attestation_hash"],
        "attestation_url": attestation_url,
        "required": True,
    }
    manifest_object = {
        "schema_version": "consentgate.v2",
        "policy_id": POLICY_ID,
        "policy_fingerprint": POLICY_FINGERPRINT,
        "request_id": REQUEST_ID,
        "request_fingerprint": REQUEST_FINGERPRINT,
        "resource_id": RESOURCE_ID,
        "evidence_version": "v1",
        "entries": [entry],
    }
    manifest = json.dumps(manifest_object, sort_keys=True, separators=(",", ":"))
    assert set(manifest_object) == {
        "schema_version", "policy_id", "policy_fingerprint", "request_id",
        "request_fingerprint", "resource_id", "evidence_version", "entries",
    }
    assert set(entry) == {
        "evidence_id", "evidence_kind", "authority_id", "source_url", "version",
        "content_sha256", "issued_at_utc", "expires_at_utc", "attestation_hash",
        "attestation_url", "required",
    }

    fixture["evidence_remote_verification"] = checks
    fixture["evidence_remote_verified"] = True
    fixture["manifest"] = manifest
    fixture["freeze_args"] = [REQUEST_ID, "v1", manifest]
    fixture["freeze_signature"] = {
        "params": [
            ["request_id", "string"],
            ["evidence_version", "string"],
            ["manifest_json", "string"],
        ],
        "ret": "string",
        "readonly": False,
    }
    fixture["freeze_simulation_passed"] = False
    save(fixture)

    live.CONTRACT = CONTRACT
    live.RPC = RPC
    live.print_argument_diagnostic("freeze_use_request", [REQUEST_ID, "v1", manifest])
    command = live.argv(
        "estimate", "freeze_use_request", [REQUEST_ID, "v1", manifest], simulation=True
    )
    code, output = live.run_captured(
        command, live.cli_environment(fixture, (manifest, None))
    )
    try:
        live.assert_simulation_success(code, output)
    except AssertionError as error:
        fixture["freeze_simulation_failure"] = str(error)
        save(fixture)
        print(f"FREEZE_SIMULATION=FAIL: {error}")
        return 1

    fixture["freeze_simulation_passed"] = True
    fixture["freeze_simulation_command"] = command
    save(fixture)
    print("REMOTE_VERIFICATION=PASS")
    print(f"CONSENT_REMOTE_URL={body_url}")
    print(f"CONSENT_REMOTE_SHA256={checks[0]['sha256']}")
    print(f"ATTESTATION_REMOTE_URL={attestation_url}")
    print(f"ATTESTATION_REMOTE_SHA256={checks[1]['sha256']}")
    print(f"EVIDENCE_ID={evidence['evidence_id']}")
    print(f"MANIFEST_JSON={manifest}")
    print("FREEZE_SIMULATION=PASS")
    print("MANUAL_FREEZE_COMMAND=")
    print(manual_command(fixture, manifest))
    print("STOP_BEFORE_WRITE=YES")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
