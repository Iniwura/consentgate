#!/usr/bin/env python3
"""Simulate the one fresh create_use_request write and print its manual command."""

from __future__ import annotations

import json
import shlex
import sys
from pathlib import Path
from typing import Any

import studio_live_test as live


ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "artifacts" / "STUDIO_DEV_HAPPY_PATH_FIXTURE.json"
CONTRACT = "0xF12088c0feaF760c6Bc8F3E5A5a445A82ae08eEc"
RPC = "https://studio-dev.genlayer.com/api"
OWNER = "0xA35dc047f9937BF668743efBDF8Ea93B31A55888"
POLICY_ID = "cgfinal20260919201751c31ce658b75a"
POLICY_FINGERPRINT = "a56672029da0aea54ded8c0d39531b825db813e1f65f3f2f1f09084644e65d1d"
REQUEST_ID = "cghappy20260919201751c31ce658b75a"
RESOURCE_ID = "profile20260919201751c31ce658b75a"
REQUEST_EXPIRY = "2026-09-20T20:17:51Z"
RETENTION_UNTIL = "2026-09-20T08:17:51Z"


def save(fixture: dict[str, Any]) -> None:
    FIXTURE.write_text(json.dumps(fixture, indent=2) + "\n", encoding="utf-8")


def manual_command(fixture: dict[str, Any]) -> str:
    command = live.argv("write", "create_use_request", fixture["request_args"])
    env = live.cli_environment(fixture)
    prefix = [
        f"DBUS_SESSION_BUS_ADDRESS={env['DBUS_SESSION_BUS_ADDRESS']}",
        f"NODE_OPTIONS={env['NODE_OPTIONS']}",
        f"CG_RAW_ARG_1={env['CG_RAW_ARG_1']}",
        f"CG_RAW_ARG_2={env['CG_RAW_ARG_2']}",
    ]
    return shlex.join(prefix + command)


def main() -> int:
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    assert fixture["contract"] == CONTRACT
    assert fixture["policy_id"] == POLICY_ID
    assert fixture["request_id"] == REQUEST_ID
    assert fixture["resource_id"] == RESOURCE_ID
    replay_nonce = fixture["request_args"][10]
    assert isinstance(replay_nonce, str) and replay_nonce
    assert len(set(replay_nonce)) > 4

    request_args: list[Any] = [
        REQUEST_ID,
        POLICY_ID,
        RESOURCE_ID,
        "account access verification",
        "identity profile",
        "ConsentGate Demo App",
        REQUEST_EXPIRY,
        RETENTION_UNTIL,
        "NONE",
        False,
        replay_nonce,
    ]
    fixture.update(
        {
            "policy_fingerprint": POLICY_FINGERPRINT,
            "policy_readback": {
                "policy_id": POLICY_ID,
                "resource_id": RESOURCE_ID,
                "policy_fingerprint": POLICY_FINGERPRINT,
                "readback_status": "PASS",
            },
            "create_use_request_signature": {
                "params": [
                    ["request_id", "string"],
                    ["policy_id", "string"],
                    ["resource_id", "string"],
                    ["purpose", "string"],
                    ["data_category", "string"],
                    ["recipient", "string"],
                    ["request_expires_at_utc", "string"],
                    ["retention_until_utc", "string"],
                    ["sharing_mode", "string"],
                    ["commercial_use", "bool"],
                    ["replay_nonce", "string"],
                ],
                "ret": "string",
                "readonly": False,
            },
            "request_args": request_args,
            "create_simulation_passed": False,
        }
    )
    save(fixture)

    live.CONTRACT = CONTRACT
    live.RPC = RPC
    live.OWNER = OWNER
    live.print_argument_diagnostic("create_use_request", request_args)
    command = live.argv("estimate", "create_use_request", request_args, simulation=True)
    code, output = live.run_captured(command, live.cli_environment(fixture))
    try:
        live.assert_simulation_success(code, output)
    except AssertionError as error:
        fixture["create_simulation_failure"] = str(error)
        save(fixture)
        print(f"CREATE_USE_REQUEST_SIMULATION=FAIL: {error}")
        return 1

    fixture["create_simulation_passed"] = True
    fixture["create_simulation_command"] = command
    save(fixture)
    print("CREATE_USE_REQUEST_SIMULATION=PASS")
    print(f"REQUEST_ID={REQUEST_ID}")
    print(f"REPLAY_NONCE={replay_nonce}")
    print(f"REQUEST_EXPIRY={REQUEST_EXPIRY}")
    print(f"RETENTION_UNTIL={RETENTION_UNTIL}")
    print("MANUAL_CREATE_USE_REQUEST_WRITE_COMMAND=")
    print(manual_command(fixture))
    print("STOP_BEFORE_WRITE=YES")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
