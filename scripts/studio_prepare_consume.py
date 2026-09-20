#!/usr/bin/env python3
"""Prepare and simulate consume_capability without printing the nonce."""

from __future__ import annotations

import hashlib
import json
import secrets
from pathlib import Path
from typing import Any

import studio_live_test as live


ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "artifacts" / "STUDIO_DEV_HAPPY_PATH_FIXTURE.json"
CONTRACT = "0xF12088c0feaF760c6Bc8F3E5A5a445A82ae08eEc"
RPC = "https://studio-dev.genlayer.com/api"
REQUEST_ID = "cghappy20260919201751c31ce658b75a"
CAPABILITY_ID = "cap_a5a674406a45e3de32cb88f1a165f283851ba5e3"
RESOURCE_ID = "profile20260919201751c31ce658b75a"
PURPOSE = "account access verification"
RECIPIENT = "ConsentGate Demo App"
SHARING_MODE = "NONE"
COMMERCIAL_USE = False


def save(fixture: dict[str, Any]) -> None:
    FIXTURE.write_text(json.dumps(fixture, indent=2) + "\n", encoding="utf-8")


def presentation_hash(capability_id: str, nonce: str) -> str:
    encoded = json.dumps(
        ["CG-PRESENTATION-V2", capability_id, nonce],
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def manual_command() -> str:
    env = live.cli_environment({})
    fixture_path = str(FIXTURE)
    return (
        f"DBUS_SESSION_BUS_ADDRESS={env['DBUS_SESSION_BUS_ADDRESS']} \\\n"
        f"NODE_OPTIONS={repr(env['NODE_OPTIONS'])} \\\n"
        f"NONCE=\"$(python3 -c 'import json; print(json.load(open(\"{fixture_path}\"))[\"presentation_nonce\"])')\" \\\n"
        f"/home/ini/.local/bin/genlayer write {CONTRACT} consume_capability "
        f"--rpc {RPC} --wallet keystore --fees {live.FEES!r} --fee-value {live.FEE_VALUE} "
        f"--args {CAPABILITY_ID} \"$NONCE\" {RESOURCE_ID} "
        f"{PURPOSE!r} {RECIPIENT!r} {SHARING_MODE} false"
    )


def main() -> int:
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    assert fixture["contract"] == CONTRACT
    assert fixture["request_id"] == REQUEST_ID
    assert fixture["capability_id"] == CAPABILITY_ID
    assert fixture["request_result"]["state"] == "AUTHORIZED"

    nonce = fixture.get("presentation_nonce")
    if nonce is None:
        nonce = secrets.token_hex(32)
        fixture["presentation_nonce"] = nonce
    assert isinstance(nonce, str)
    assert len(nonce) == 64
    assert all(ch in "0123456789abcdef" for ch in nonce)
    expected_hash = presentation_hash(CAPABILITY_ID, nonce)
    fixture["expected_presentation_nonce_hash"] = expected_hash
    fixture["consume_capability_signature"] = {
        "params": [
            ["capability_id", "string"],
            ["presentation_nonce", "string"],
            ["resource_id", "string"],
            ["purpose", "string"],
            ["recipient", "string"],
            ["sharing_mode", "string"],
            ["commercial_use", "bool"],
        ],
        "ret": "string",
        "readonly": False,
    }
    fixture["consumption"] = {
        "capability_id": CAPABILITY_ID,
        "authorized_caller": fixture["request_result"].get(
            "requester", "0xA35dc047f9937BF668743efBDF8Ea93B31A55888"
        ),
        "required_capability_state": "CAPABILITY_ISSUED",
        "expected_capability_state_after": "CAPABILITY_CONSUMED",
        "expected_request_state_after": "CAPABILITY_CONSUMED",
        "raw_nonce_persisted": False,
        "write_pending": True,
    }
    fixture["consume_simulation_passed"] = False
    save(fixture)

    args = [
        CAPABILITY_ID,
        nonce,
        RESOURCE_ID,
        PURPOSE,
        RECIPIENT,
        SHARING_MODE,
        COMMERCIAL_USE,
    ]
    live.CONTRACT = CONTRACT
    live.RPC = RPC
    command = live.argv("estimate", "consume_capability", args, simulation=True)
    # Do not print argument diagnostics: index 1 is the saved secret nonce.
    code, output = live.run_captured(command, live.cli_environment(fixture))
    try:
        live.assert_simulation_success(code, output)
    except AssertionError as error:
        fixture["consume_simulation_failure"] = str(error)
        save(fixture)
        print(f"SIMULATION=FAIL: {error}")
        return 1

    fixture["consume_simulation_passed"] = True
    fixture["consume_simulation_command"] = command
    save(fixture)
    print("SIMULATION=PASS")
    print(f"EXPECTED_PRESENTATION_NONCE_HASH={expected_hash}")
    print("PRESENTATION_NONCE=stored_only_in_fixture")
    print("MANUAL_CONSUME_COMMAND=")
    print(manual_command())
    print("STOP_BEFORE_WRITE=YES")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
