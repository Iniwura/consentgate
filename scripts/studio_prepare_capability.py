#!/usr/bin/env python3
"""Prepare and simulate the one corrected-contract issue_capability write."""

from __future__ import annotations

import hashlib
import json
import shlex
from pathlib import Path
from typing import Any

import studio_live_test as live


ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "artifacts" / "STUDIO_DEV_HAPPY_PATH_FIXTURE.json"
CONTRACT = "0xF12088c0feaF760c6Bc8F3E5A5a445A82ae08eEc"
RPC = "https://studio-dev.genlayer.com/api"
REQUEST_ID = "cghappy20260919201751c31ce658b75a"
POLICY_ID = "cgfinal20260919201751c31ce658b75a"
POLICY_FINGERPRINT = "a56672029da0aea54ded8c0d39531b825db813e1f65f3f2f1f09084644e65d1d"
REQUEST_FINGERPRINT = "93f6744524393764d85a92c70303dcc64c97f26bba13738a80bcaaf0539ab622"
EVIDENCE_SET_FINGERPRINT = "0ccc8f80ff1dd911fd44b7b8b0ffca2141ef1a6d1104df05ead79fb6c3f9f5b5"
RESULT_FINGERPRINT = "97ed77ac648c79de55d1b3e26e0e027a5b048b5f69cf4a1913ca4888f7b28761"
REQUESTER = "0xA35dc047f9937BF668743efBDF8Ea93B31A55888"
RESOURCE_ID = "profile20260919201751c31ce658b75a"
CAPABILITY_EXPIRY = "2026-09-20T08:17:51Z"


def save(fixture: dict[str, Any]) -> None:
    FIXTURE.write_text(json.dumps(fixture, indent=2) + "\n", encoding="utf-8")


def source_hash(label: str, *parts: Any) -> str:
    payload = json.dumps([label, *parts], ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def manual_command() -> str:
    command = live.argv("write", "issue_capability", [REQUEST_ID])
    env = live.cli_environment({})
    # This transaction has only one string argument, so no CG_RAW_ARG_*
    # preservation variables are needed. Keep assignments valid Bash syntax.
    return (
        f"DBUS_SESSION_BUS_ADDRESS={env['DBUS_SESSION_BUS_ADDRESS']} \\\n"
        f"NODE_OPTIONS={shlex.quote(env['NODE_OPTIONS'])} \\\n"
        + shlex.join(command)
    )


def main() -> int:
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    assert fixture["contract"] == CONTRACT
    assert fixture["request_id"] == REQUEST_ID
    assert fixture["policy_id"] == POLICY_ID
    assert fixture["policy_fingerprint"] == POLICY_FINGERPRINT
    assert fixture["request_result"]["request_fingerprint"] == REQUEST_FINGERPRINT

    capability_id = "cap_" + source_hash(
        "CG-CAPABILITY-ID-V2",
        REQUEST_ID,
        POLICY_ID,
        POLICY_FINGERPRINT,
        REQUEST_FINGERPRINT,
        EVIDENCE_SET_FINGERPRINT,
        RESULT_FINGERPRINT,
        REQUESTER,
        RESOURCE_ID,
    )[:40]
    assert capability_id.startswith("cap_")
    assert len(capability_id) == 44

    fixture["request_result"].update(
        {
            "state": "AUTHORIZED",
            "effective_state": "AUTHORIZED",
            "evidence_set_id": "ev_9dc2f76e269811b4d7dbd85da57ceca16e7206b8",
            "evidence_set_fingerprint": EVIDENCE_SET_FINGERPRINT,
            "result_fingerprint": RESULT_FINGERPRINT,
            "capability_id": "",
        }
    )
    fixture["authorization"] = {
        "state": "AUTHORIZED",
        "review_status": "AUTHORIZED",
        "decision": "AUTHORIZE",
        "review_revision": 1,
        "result_fingerprint": RESULT_FINGERPRINT,
        "evidence_set_id": "ev_9dc2f76e269811b4d7dbd85da57ceca16e7206b8",
        "evidence_set_fingerprint": EVIDENCE_SET_FINGERPRINT,
        "evidence_set_consumed": True,
        "evidence_set_superseded": False,
    }
    fixture["capability_id"] = capability_id
    fixture["capability_expiry"] = CAPABILITY_EXPIRY
    fixture["capability_secret_or_nonce_requirement"] = (
        "NONE for issue_capability; presentation_nonce is required only by consume_capability"
    )
    fixture["presentation_commitment"] = (
        "NONE at issuance; presentation_nonce_hash remains empty until consume_capability"
    )
    fixture["issue_capability_signature"] = {
        "params": [["request_id", "string"]],
        "ret": "string",
        "readonly": False,
    }
    fixture["capability_simulation_passed"] = False
    fixture["capability_write_pending"] = True
    save(fixture)

    live.CONTRACT = CONTRACT
    live.RPC = RPC
    live.print_argument_diagnostic("issue_capability", [REQUEST_ID])
    command = live.argv("estimate", "issue_capability", [REQUEST_ID], simulation=True)
    code, output = live.run_captured(command, live.cli_environment(fixture))
    try:
        live.assert_simulation_success(code, output)
    except AssertionError as error:
        fixture["capability_simulation_failure"] = str(error)
        save(fixture)
        print(f"SIMULATION=FAIL: {error}")
        return 1

    fixture["capability_simulation_passed"] = True
    fixture["capability_simulation_command"] = command
    save(fixture)
    print("SIMULATION=PASS")
    print(f"CAPABILITY_ID={capability_id}")
    print(f"CAPABILITY_EXPIRY={CAPABILITY_EXPIRY}")
    print("CAPABILITY_SECRET_OR_NONCE_REQUIREMENT=NONE_FOR_ISSUE")
    print("PRESENTATION_COMMITMENT=NONE_AT_ISSUANCE")
    print("MANUAL_ISSUE_COMMAND=")
    print(manual_command())
    print("STOP_BEFORE_WRITE=YES")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
