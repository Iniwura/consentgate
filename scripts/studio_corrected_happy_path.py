#!/usr/bin/env python3
"""Prepare the corrected-contract Studio Dev happy path.

This wrapper reuses the JSON-preserving subprocess argv implementation in
``studio_live_test.py`` while isolating all state from the superseded address
and historical fixtures.  It intentionally stops after the first successful
register_policy simulation and prints one manual keystore-write command.
"""

from __future__ import annotations

import json
import secrets
import shlex
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import studio_live_test as live


ROOT = Path(__file__).resolve().parents[1]
CONTRACT = "0xF12088c0feaF760c6Bc8F3E5A5a445A82ae08eEc"
RPC = "https://studio-dev.genlayer.com/api"
OWNER = "0xA35dc047f9937BF668743efBDF8Ea93B31A55888"
FIXTURE = ROOT / "artifacts" / "STUDIO_DEV_HAPPY_PATH_FIXTURE.json"


def canonical(value: datetime) -> str:
    return value.astimezone(timezone.utc).replace(microsecond=0).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )


def make_fixture() -> dict[str, Any]:
    now = datetime.now(timezone.utc).replace(microsecond=0)
    token = now.strftime("%Y%m%d%H%M%S") + secrets.token_hex(6)
    policy_id = f"cgfinal{token}"
    request_id = f"cghappy{token}"
    resource_id = f"profile{token}"
    policy_expiry = canonical(now + timedelta(days=7))
    request_expiry = canonical(now + timedelta(days=1))
    retention_until = canonical(now + timedelta(hours=12))

    authorities = [
        {
            "authority_id": "demoauthority",
            "authority_key_id": "demokeyv1",
            "origin": "https://raw.githubusercontent.com",
            "attestation_path_prefix": "/Iniwura/consentgate/main/evidence/",
        }
    ]
    dimensions = [
        ("POLICY_BINDING", "The request and evidence must bind to this policy, resource, requester and immutable fingerprints."),
        ("CONSENT_EXPIRY", "Consent evidence must be current and unexpired at review time."),
        ("PURPOSE", "The requested purpose must be account access verification."),
        ("DATA_CATEGORY", "The requested data category must be identity profile."),
        ("RECIPIENT", "The recipient must be ConsentGate Demo App."),
        ("RETENTION", "Retention must remain inside the request and policy validity windows."),
        ("SHARING", "Sharing mode must be NONE."),
        ("COMMERCIAL_USE", "Commercial use must be false."),
        ("EVIDENCE_SUFFICIENCY", "Evidence must come from an approved authority and prove current consent for this exact use."),
    ]
    rules = [
        {"rule_id": f"r{index:02d}", "dimension": dimension, "description": description}
        for index, (dimension, description) in enumerate(dimensions, start=1)
    ]
    authorities_json = json.dumps(authorities, separators=(",", ":"))
    rules_json = json.dumps(rules, separators=(",", ":"))
    policy_text = (
        f"ConsentGate authorizes use of resource {resource_id} only for account "
        "access verification. The allowed data category is identity profile. "
        "The only approved recipient is ConsentGate Demo App. Sharing must be "
        f"NONE. Commercial use is prohibited. Retention ends at {retention_until}."
    )
    policy_args: list[Any] = [
        policy_id,
        resource_id,
        policy_text,
        "v1",
        policy_expiry,
        authorities_json,
        rules_json,
        86400,
    ]
    request_args: list[Any] = [
        request_id,
        policy_id,
        resource_id,
        "account access verification",
        "identity profile",
        "ConsentGate Demo App",
        request_expiry,
        retention_until,
        "NONE",
        False,
        f"replay{token}",
    ]
    live.validate_policy_args(policy_args)
    return {
        "network": "studio-dev",
        "rpc": RPC,
        "contract": CONTRACT,
        "owner": OWNER,
        "generated_at_utc": canonical(now),
        "simulation_passed": False,
        "policy_id": policy_id,
        "request_id": request_id,
        "resource_id": resource_id,
        "policy_expiry": policy_expiry,
        "request_expiry": request_expiry,
        "retention_until": retention_until,
        "authorities_json": authorities_json,
        "rules_json": rules_json,
        "policy_args": policy_args,
        "request_args": request_args,
    }


def save_fixture(fixture: dict[str, Any]) -> None:
    FIXTURE.parent.mkdir(parents=True, exist_ok=True)
    FIXTURE.write_text(json.dumps(fixture, indent=2) + "\n", encoding="utf-8")


def manual_write_command(fixture: dict[str, Any]) -> str:
    live.CONTRACT = CONTRACT
    command = live.argv("write", "register_policy", fixture["policy_args"])
    env = live.cli_environment(fixture)
    prefix = [
        f"DBUS_SESSION_BUS_ADDRESS={env['DBUS_SESSION_BUS_ADDRESS']}",
        f"NODE_OPTIONS={env['NODE_OPTIONS']}",
        f"CG_RAW_ARG_1={env['CG_RAW_ARG_1']}",
        f"CG_RAW_ARG_2={env['CG_RAW_ARG_2']}",
    ]
    return shlex.join(prefix + command)


def main() -> int:
    live.CONTRACT = CONTRACT
    live.RPC = RPC
    live.OWNER = OWNER
    fixture = make_fixture()
    live.print_argument_diagnostic("register_policy", fixture["policy_args"])
    command = live.argv("estimate", "register_policy", fixture["policy_args"], simulation=True)
    code, output = live.run_captured(command, live.cli_environment(fixture))
    try:
        live.assert_simulation_success(code, output)
    except AssertionError as error:
        fixture["simulation_failure"] = str(error)
        save_fixture(fixture)
        print(f"REGISTER_POLICY_SIMULATION=FAIL: {error}")
        return 1

    fixture["simulation_passed"] = True
    fixture["simulation_command"] = command
    save_fixture(fixture)
    print("REGISTER_POLICY_SIMULATION=PASS")
    print(f"POLICY_ID={fixture['policy_id']}")
    print(f"REQUEST_ID={fixture['request_id']}")
    print("MANUAL_REGISTER_POLICY_WRITE_COMMAND=")
    print(manual_write_command(fixture))
    print("STOP_BEFORE_WRITE=YES")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
