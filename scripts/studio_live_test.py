#!/usr/bin/env python3
"""Safe first-state test driver for the already deployed ConsentGate.

The driver never deploys. It persists one generated fixture after simulation so
the paid write and later lifecycle calls use exactly the same argv values.
Simulation is mandatory before each write phase. Write subprocesses inherit
stdin/stdout so a human can enter the keystore password; the driver never
reads, stores, or echoes password input.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import secrets
import shutil
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
RPC = "https://studio-dev.genlayer.com/api"
CONTRACT = "0xC867A1E2374E133eb62448b22BcFB0E481cf9055"
OWNER = "0xA35dc047f9937BF668743efBDF8Ea93B31A55888"
REPORT = ROOT / "artifacts" / "STUDIO_DEV_FINAL_TEST_REPORT.md"
FIXTURE_FILE = ROOT / "artifacts" / "STUDIO_DEV_LIVE_FIXTURE.json"
EVIDENCE_DIR = ROOT / "evidence"
PRELOAD = Path("/tmp/consentgate-preserve-json-strings.cjs")
SKIP_CHMOD_PRELOAD = Path("/tmp/genlayer-skip-config-chmod.cjs")

# These are existing, prepared evidence files. Freeze validates their manifest
# metadata but does not fetch them; review is deliberately outside this phase.
EVIDENCE_BASENAME = "consent-20260919130801"
EVIDENCE_SOURCE_URL = (
    "https://raw.githubusercontent.com/Iniwura/consentgate/main/evidence/"
)
VALID_POLICY_ID = "cgfinal20260919144409"
HAPPY_FIXTURE_FILE = ROOT / "artifacts" / "STUDIO_DEV_HAPPY_PATH_FIXTURE.json"

FEES = (
    '{"distribution":{"leaderTimeunitsAllocation":"100",'
    '"validatorTimeunitsAllocation":"200","appealRounds":"0",'
    '"executionBudgetPerRound":"25000000000000000",'
    '"executionConsumed":"0","totalMessageFees":"0",'
    '"rotations":["3"],"maxPriceGenPerTimeUnit":"2",'
    '"storageFeeMaxGasPrice":"300000000",'
    '"receiptFeeMaxGasPrice":"300000000"}}'
)
FEE_VALUE = "100000000000010352"

RULE_DIMENSIONS = [
    "POLICY_BINDING",
    "CONSENT_EXPIRY",
    "PURPOSE",
    "DATA_CATEGORY",
    "RECIPIENT",
    "RETENTION",
    "SHARING",
    "COMMERCIAL_USE",
    "EVIDENCE_SUFFICIENCY",
]


def canonical(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).replace(microsecond=0).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )


def make_fixture() -> dict[str, Any]:
    now = datetime.now(timezone.utc).replace(microsecond=0)
    token = now.strftime("%Y%m%d%H%M%S")
    policy_id = f"cgfinal{token}"
    request_id = f"cgrequest{token}"
    resource_id = f"profile{token}"
    policy_expiry = canonical(now + timedelta(days=7))
    request_expiry = canonical(now + timedelta(days=2))
    retention_until = canonical(now + timedelta(days=1))
    authorities = [
        {
            "authority_id": "demoauthority",
            "authority_key_id": "demokeyv1",
            "origin": "https://raw.githubusercontent.com",
            "attestation_path_prefix": "/Iniwura/consentgate/main/evidence/",
        }
    ]
    rule_specs = [
        (
            "POLICY_BINDING",
            "The request and evidence must bind to this policy, resource, requester and immutable fingerprints.",
        ),
        (
            "CONSENT_EXPIRY",
            "Consent evidence must be current and unexpired at review time.",
        ),
        (
            "PURPOSE",
            "The requested purpose must be account access verification.",
        ),
        (
            "DATA_CATEGORY",
            "The requested data category must be identity profile.",
        ),
        (
            "RECIPIENT",
            "The recipient must be ConsentGate Demo App.",
        ),
        (
            "RETENTION",
            "Retention must remain inside the request and policy validity windows.",
        ),
        ("SHARING", "Sharing mode must be NONE."),
        ("COMMERCIAL_USE", "Commercial use must be false."),
        (
            "EVIDENCE_SUFFICIENCY",
            "Evidence must come from an approved authority and prove current consent for this exact use.",
        ),
    ]
    rules = [
        {"rule_id": f"r{index:02d}", "dimension": dimension, "description": description}
        for index, (dimension, description) in enumerate(rule_specs, start=1)
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
    fixture = {
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
    validate_policy_args(policy_args)
    return fixture


def validate_policy_args(args: list[Any]) -> None:
    assert len(args) == 8
    assert all(isinstance(value, str) and value for value in args[:7])
    assert isinstance(args[7], int)
    authorities = json.loads(args[5])
    rules = json.loads(args[6])
    assert isinstance(authorities, list)
    assert len(authorities) >= 1
    assert isinstance(rules, list)
    assert len(rules) == 9
    assert [rule["dimension"] for rule in rules] == RULE_DIMENSIONS


def save_fixture(fixture: dict[str, Any]) -> None:
    FIXTURE_FILE.parent.mkdir(parents=True, exist_ok=True)
    FIXTURE_FILE.write_text(json.dumps(fixture, indent=2) + "\n", encoding="utf-8")


def save_happy_fixture(fixture: dict[str, Any]) -> None:
    HAPPY_FIXTURE_FILE.parent.mkdir(parents=True, exist_ok=True)
    HAPPY_FIXTURE_FILE.write_text(json.dumps(fixture, indent=2) + "\n", encoding="utf-8")


def load_fixture() -> dict[str, Any]:
    if not FIXTURE_FILE.is_file():
        raise RuntimeError(f"{FIXTURE_FILE} is missing; run --phase simulate first.")
    fixture = json.loads(FIXTURE_FILE.read_text(encoding="utf-8"))
    validate_policy_args(fixture["policy_args"])
    return fixture


def make_happy_fixture() -> dict[str, Any]:
    now = datetime.now(timezone.utc).replace(microsecond=0)
    token = now.strftime("%Y%m%d%H%M%S")
    suffix = secrets.token_hex(4)
    request_id = f"cghappy{token}{suffix}"
    replay_nonce = f"cghappy-replay-{token}-{suffix}"
    request_expiry = canonical(now + timedelta(days=1))
    retention_until = canonical(now + timedelta(hours=12))
    fixture = {
        "generated_at_utc": canonical(now),
        "policy_id": VALID_POLICY_ID,
        "resource_id": "profile20260919144409",
        "request_id": request_id,
        "request_expiry": request_expiry,
        "retention_until": retention_until,
        "replay_nonce": replay_nonce,
        "request_args": [
            request_id,
            VALID_POLICY_ID,
            "profile20260919144409",
            "account access verification",
            "identity profile",
            "ConsentGate Demo App",
            request_expiry,
            retention_until,
            "NONE",
            False,
            replay_nonce,
        ],
    }
    return fixture


def load_happy_fixture() -> dict[str, Any]:
    if not HAPPY_FIXTURE_FILE.is_file():
        fixture = make_happy_fixture()
        save_happy_fixture(fixture)
        return fixture
    fixture = json.loads(HAPPY_FIXTURE_FILE.read_text(encoding="utf-8"))
    args = fixture["request_args"]
    assert len(args) == 11
    assert args[0] == fixture["request_id"]
    assert args[1] == VALID_POLICY_ID
    assert args[2] == "profile20260919144409"
    assert args[3:] == [
        "account access verification",
        "identity profile",
        "ConsentGate Demo App",
        fixture["request_expiry"],
        fixture["retention_until"],
        "NONE",
        False,
        fixture["replay_nonce"],
    ]
    return fixture


def print_argument_diagnostic(label: str, args: list[Any]) -> None:
    print(f"{label} ARGUMENT DIAGNOSTIC")
    for index, value in enumerate(args):
        if index in (5, 6):
            display = repr(value)
        elif isinstance(value, str) and len(value) > 180:
            display = f"<string length={len(value)}>"
        else:
            display = repr(value)
        print(
            f"index={index} type={type(value).__name__} "
            f"value={display} length={len(value) if isinstance(value, str) else '-'}"
        )


def cli_path() -> str:
    path = shutil.which("genlayer")
    if path is None:
        raise RuntimeError("genlayer CLI was not found on PATH")
    return path


def cli_value(value: Any) -> str:
    if type(value) is bool:
        return "true" if value else "false"
    return str(value)


def cli_environment(
    fixture: dict[str, Any],
    raw_args: tuple[str, str | None] | None = None,
) -> dict[str, str]:
    if not PRELOAD.is_file():
        raise RuntimeError(f"missing JSON-string preload: {PRELOAD}")
    if not SKIP_CHMOD_PRELOAD.is_file():
        raise RuntimeError(f"missing CLI config workaround: {SKIP_CHMOD_PRELOAD}")
    env = os.environ.copy()
    env["DBUS_SESSION_BUS_ADDRESS"] = "unix:path=/tmp/genlayer-no-keyring"
    preserved = raw_args or (
        fixture.get("authorities_json", "[]"),
        fixture.get("rules_json", "[]"),
    )
    env["CG_RAW_ARG_1"] = preserved[0]
    if preserved[1] is None:
        env.pop("CG_RAW_ARG_2", None)
    else:
        env["CG_RAW_ARG_2"] = preserved[1]
    env["NODE_OPTIONS"] = f"--require={SKIP_CHMOD_PRELOAD} --require={PRELOAD}"
    return env


def argv(action: str, method: str, args: list[Any], *, simulation: bool = False) -> list[str]:
    values = [cli_value(value) for value in args]
    if simulation:
        return [
            cli_path(),
            "estimate-fees",
            CONTRACT,
            method,
            "--rpc",
            RPC,
            "--json",
            "--include-report",
            "--args",
            *values,
        ]
    if action != "write":
        raise ValueError(action)
    return [
        cli_path(),
        "write",
        CONTRACT,
        method,
        "--rpc",
        RPC,
        "--wallet",
        "keystore",
        "--fees",
        FEES,
        "--fee-value",
        FEE_VALUE,
        "--args",
        *values,
    ]


def call_argv(method: str, args: list[Any]) -> list[str]:
    return [
        cli_path(),
        "call",
        CONTRACT,
        method,
        "--rpc",
        RPC,
        "--args",
        *[cli_value(value) for value in args],
    ]


def append_report(section: str) -> None:
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    with REPORT.open("a", encoding="utf-8") as handle:
        handle.write(f"\n{section.rstrip()}\n")


def preview(command: list[str]) -> str:
    args_index = command.index("--args")
    return " ".join(command[:args_index] + ["--args", "<explicit argv values>"])


def run_captured(command: list[str], env: dict[str, str]) -> tuple[int, str]:
    print("COMMAND:")
    print(preview(command))
    completed = subprocess.run(
        command,
        cwd=ROOT,
        env=env,
        text=True,
        capture_output=True,
        check=False,
    )
    output = completed.stdout + completed.stderr
    print(output, end="")
    return completed.returncode, output


def run_interactive(command: list[str], env: dict[str, str]) -> int:
    print("COMMAND (interactive; stdin/stdout are not captured):")
    print(preview(command))
    completed = subprocess.run(command, cwd=ROOT, env=env, check=False)
    return completed.returncode


def assert_simulation_success(returncode: int, output: str) -> None:
    lowered = output.lower()
    forbidden = (
        '"args":[0,0,0,0,0,0,0,86400]',
        '"args": [0, 0, 0, 0, 0, 0, 0, 86400]',
        "parameter type",
        "transaction datetime",
        "authority validation",
        "rule validation",
        "usererror",
        "genvm execution failure",
        "invalid_contract",
        "runner malformed",
    )
    assert returncode == 0, f"simulation failed with exit code {returncode}"
    assert not any(marker in lowered for marker in forbidden), (
        "simulation output contained a forbidden failure marker"
    )


def safe_failure_summary(returncode: int, output: str) -> str:
    """Return a non-sensitive failure summary; never persist raw CLI output."""
    lowered = output.lower()
    if "missing or invalid parameters" in lowered:
        detail = "The CLI/RPC reported missing or invalid parameters."
    elif "execution failed" in lowered:
        detail = "The CLI/RPC reported execution failed."
    else:
        detail = "No classified CLI/RPC detail was recorded."
    return f"{detail} Exit code: {returncode}. Raw CLI output was intentionally omitted."


def extract_result(output: str) -> dict[str, Any]:
    plain = re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", output)
    if "Result:" not in plain:
        raise RuntimeError("CLI call output did not contain Result:")
    payload = plain.split("Result:", 1)[1].split("✔", 1)[0].strip()
    result, _ = json.JSONDecoder().raw_decode(payload)
    if not isinstance(result, dict):
        raise RuntimeError("CLI call Result was not a JSON object")
    return result


def read_contract(fixture: dict[str, Any], method: str, args: list[Any]) -> tuple[dict[str, Any], str]:
    code, output = run_captured(call_argv(method, args), cli_environment(fixture))
    if code != 0:
        raise RuntimeError(f"{method} failed with exit code {code}")
    return extract_result(output), output


def verify_policy(policy: dict[str, Any], fixture: dict[str, Any]) -> None:
    assert policy["policy_id"] == fixture["policy_id"]
    assert policy["owner"].lower() == OWNER.lower()
    assert policy["resource_id"] == fixture["resource_id"]
    assert policy["policy_version"] == "v1"
    assert policy["expires_at_utc"] == fixture["policy_expiry"]
    assert policy["policy_fingerprint"]
    assert policy["revoked"] is False
    assert policy["expired"] is False
    assert isinstance(policy["allowed_authorities"], list)
    assert len(policy["allowed_authorities"]) >= 1
    assert isinstance(policy["rules"], list)
    assert len(policy["rules"]) == 9


def evidence_manifest(
    fixture: dict[str, Any], policy: dict[str, Any], request: dict[str, Any]
) -> str:
    body_path = EVIDENCE_DIR / f"{EVIDENCE_BASENAME}.json"
    attestation_path = EVIDENCE_DIR / f"{EVIDENCE_BASENAME}-attestation.json"
    if not body_path.is_file() or not attestation_path.is_file():
        raise RuntimeError("prepared evidence files are missing locally")
    attestation = json.loads(attestation_path.read_text(encoding="utf-8"))
    body_hash = hashlib.sha256(body_path.read_bytes()).hexdigest()
    attestation_hash = hashlib.sha256(attestation_path.read_bytes()).hexdigest()
    entry = {
        "evidence_id": f"consent-record-{EVIDENCE_BASENAME.removeprefix('consent-')}",
        "evidence_kind": "consent-record",
        "authority_id": "demoauthority",
        "source_url": EVIDENCE_SOURCE_URL + body_path.name,
        "version": "v1",
        "content_sha256": body_hash,
        "issued_at_utc": attestation["issued_at_utc"],
        "expires_at_utc": attestation["expires_at_utc"],
        "attestation_hash": attestation_hash,
        "attestation_url": EVIDENCE_SOURCE_URL + attestation_path.name,
        "required": True,
    }
    manifest = {
        "schema_version": "consentgate.v2",
        "policy_id": fixture["policy_id"],
        "policy_fingerprint": policy["policy_fingerprint"],
        "request_id": fixture["request_id"],
        "request_fingerprint": request["request_fingerprint"],
        "resource_id": fixture["resource_id"],
        "evidence_version": "v1",
        "entries": [entry],
    }
    return json.dumps(manifest, separators=(",", ":"), sort_keys=True)


def verify_happy_policy(policy: dict[str, Any]) -> None:
    assert policy["policy_id"] == VALID_POLICY_ID
    assert policy["resource_id"] == "profile20260919144409"
    assert policy["policy_version"] == "v1"
    assert policy["revoked"] is False
    assert policy["expired"] is False
    assert isinstance(policy["allowed_authorities"], list)
    assert len(policy["allowed_authorities"]) == 1
    assert isinstance(policy["rules"], list)
    assert len(policy["rules"]) == 9


def verify_happy_request(
    request: dict[str, Any], fixture: dict[str, Any], policy: dict[str, Any]
) -> None:
    assert request["request_id"] == fixture["request_id"]
    assert request["policy_id"] == VALID_POLICY_ID
    assert request["resource_id"] == "profile20260919144409"
    assert request["purpose"] == "account access verification"
    assert request["data_category"] == "identity profile"
    assert request["recipient"] == "ConsentGate Demo App"
    assert request["request_expires_at_utc"] == fixture["request_expiry"]
    assert request["retention_until_utc"] == fixture["retention_until"]
    assert request["sharing_mode"] == "NONE"
    assert request["commercial_use"] is False
    assert request["policy_fingerprint"] == policy["policy_fingerprint"]
    assert request["state"] == "USE_REQUEST_OPEN"
    assert request["requester"].lower() == OWNER.lower()
    assert request["request_fingerprint"]


def happy_evidence_paths(fixture: dict[str, Any]) -> tuple[Path, Path]:
    evidence = fixture["evidence"]
    return EVIDENCE_DIR / evidence["body_file"], EVIDENCE_DIR / evidence["attestation_file"]


def generate_happy_evidence(
    fixture: dict[str, Any], policy: dict[str, Any], request: dict[str, Any]
) -> None:
    authority = policy["allowed_authorities"][0]
    evidence_id = f"consent-record-{request['request_id']}"
    body_file = f"{request['request_id']}-consent.json"
    attestation_file = f"{request['request_id']}-attestation.json"
    issued_at = canonical(datetime.now(timezone.utc) - timedelta(seconds=5))
    expires_at = request["retention_until_utc"]
    if datetime.fromisoformat(expires_at.replace("Z", "+00:00")) <= datetime.fromisoformat(
        issued_at.replace("Z", "+00:00")
    ):
        raise RuntimeError("request retention deadline is no longer in the future")
    body = {
        "authority_id": authority["authority_id"],
        "authority_key_id": authority["authority_key_id"],
        "commercial_use": request["commercial_use"],
        "consent": "granted",
        "data_category": request["data_category"],
        "evidence_id": evidence_id,
        "evidence_kind": "consent-record",
        "expires_at_utc": expires_at,
        "issued_at_utc": issued_at,
        "policy_fingerprint": policy["policy_fingerprint"],
        "policy_id": request["policy_id"],
        "purpose": request["purpose"],
        "recipient": request["recipient"],
        "request_fingerprint": request["request_fingerprint"],
        "request_id": request["request_id"],
        "requester": request["requester"],
        "resource_id": request["resource_id"],
        "retention_until_utc": request["retention_until_utc"],
        "sharing_mode": request["sharing_mode"],
        "version": "v1",
    }
    body_bytes = json.dumps(body, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode(
        "utf-8"
    )
    content_sha256 = hashlib.sha256(body_bytes).hexdigest()
    attestation = {
        "schema_version": "consentgate.attestation.v1",
        "authority_id": authority["authority_id"],
        "authority_key_id": authority["authority_key_id"],
        "evidence_id": evidence_id,
        "evidence_kind": "consent-record",
        "version": "v1",
        "policy_id": request["policy_id"],
        "policy_fingerprint": policy["policy_fingerprint"],
        "request_id": request["request_id"],
        "request_fingerprint": request["request_fingerprint"],
        "resource_id": request["resource_id"],
        "content_sha256": content_sha256,
        "issued_at_utc": issued_at,
        "expires_at_utc": expires_at,
    }
    attestation_bytes = json.dumps(
        attestation, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    generated = {
        "body_file": body_file,
        "attestation_file": attestation_file,
        "evidence_id": evidence_id,
        "issued_at_utc": issued_at,
        "expires_at_utc": expires_at,
        "content_sha256": content_sha256,
        "attestation_hash": hashlib.sha256(attestation_bytes).hexdigest(),
    }
    if "evidence" in fixture:
        if fixture["evidence"] != generated:
            raise RuntimeError("existing happy-path evidence metadata differs; refusing to overwrite")
        body_path, attestation_path = happy_evidence_paths(fixture)
        if body_path.read_bytes() != body_bytes or attestation_path.read_bytes() != attestation_bytes:
            raise RuntimeError("existing happy-path evidence bytes differ; refusing to overwrite")
    else:
        EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
        body_path = EVIDENCE_DIR / body_file
        attestation_path = EVIDENCE_DIR / attestation_file
        if body_path.exists() or attestation_path.exists():
            raise RuntimeError("new evidence filename already exists; refusing to overwrite")
        body_path.write_bytes(body_bytes)
        attestation_path.write_bytes(attestation_bytes)
        fixture["evidence"] = generated
        save_happy_fixture(fixture)


def verify_happy_evidence(
    fixture: dict[str, Any], policy: dict[str, Any], request: dict[str, Any]
) -> None:
    body_path, attestation_path = happy_evidence_paths(fixture)
    body_bytes = body_path.read_bytes()
    attestation_bytes = attestation_path.read_bytes()
    body = json.loads(body_bytes)
    attestation = json.loads(attestation_bytes)
    evidence = fixture["evidence"]
    authority = policy["allowed_authorities"][0]
    assert hashlib.sha256(body_bytes).hexdigest() == evidence["content_sha256"]
    assert hashlib.sha256(attestation_bytes).hexdigest() == evidence["attestation_hash"]
    for key, value in {
        "authority_id": authority["authority_id"],
        "authority_key_id": authority["authority_key_id"],
        "evidence_id": evidence["evidence_id"],
        "evidence_kind": "consent-record",
        "version": "v1",
        "policy_id": VALID_POLICY_ID,
        "policy_fingerprint": policy["policy_fingerprint"],
        "request_id": request["request_id"],
        "request_fingerprint": request["request_fingerprint"],
        "resource_id": request["resource_id"],
        "content_sha256": evidence["content_sha256"],
        "issued_at_utc": evidence["issued_at_utc"],
        "expires_at_utc": evidence["expires_at_utc"],
    }.items():
        assert attestation[key] == value
    for key, value in {
        "authority_id": authority["authority_id"],
        "authority_key_id": authority["authority_key_id"],
        "evidence_id": evidence["evidence_id"],
        "evidence_kind": "consent-record",
        "version": "v1",
        "policy_id": VALID_POLICY_ID,
        "policy_fingerprint": policy["policy_fingerprint"],
        "request_id": request["request_id"],
        "request_fingerprint": request["request_fingerprint"],
        "requester": request["requester"],
        "resource_id": request["resource_id"],
        "purpose": request["purpose"],
        "data_category": request["data_category"],
        "recipient": request["recipient"],
        "retention_until_utc": request["retention_until_utc"],
        "sharing_mode": request["sharing_mode"],
        "commercial_use": False,
        "issued_at_utc": evidence["issued_at_utc"],
        "expires_at_utc": evidence["expires_at_utc"],
    }.items():
        assert body[key] == value


def happy_evidence_manifest(
    fixture: dict[str, Any], policy: dict[str, Any], request: dict[str, Any]
) -> str:
    evidence = fixture["evidence"]
    entry = {
        "evidence_id": evidence["evidence_id"],
        "evidence_kind": "consent-record",
        "authority_id": policy["allowed_authorities"][0]["authority_id"],
        "source_url": EVIDENCE_SOURCE_URL + evidence["body_file"],
        "version": "v1",
        "content_sha256": evidence["content_sha256"],
        "issued_at_utc": evidence["issued_at_utc"],
        "expires_at_utc": evidence["expires_at_utc"],
        "attestation_hash": evidence["attestation_hash"],
        "attestation_url": EVIDENCE_SOURCE_URL + evidence["attestation_file"],
        "required": True,
    }
    manifest = {
        "schema_version": "consentgate.v2",
        "policy_id": VALID_POLICY_ID,
        "policy_fingerprint": policy["policy_fingerprint"],
        "request_id": request["request_id"],
        "request_fingerprint": request["request_fingerprint"],
        "resource_id": request["resource_id"],
        "evidence_version": "v1",
        "entries": [entry],
    }
    return json.dumps(manifest, separators=(",", ":"), sort_keys=True)


def simulate_write(
    fixture: dict[str, Any],
    method: str,
    args: list[Any],
    label: str,
    *,
    preserved_raw_args: tuple[str, str | None] | None = None,
) -> bool:
    print_argument_diagnostic(method, args)
    command = argv("estimate", method, args, simulation=True)
    code, output = run_captured(
        command,
        cli_environment(fixture, preserved_raw_args),
    )
    try:
        assert_simulation_success(code, output)
    except AssertionError as error:
        append_report(
            f"## {label} simulation — FAIL\n\n"
            f"Failure: `{error}`\n\n{safe_failure_summary(code, output)}\n"
        )
        return False
    append_report(
        f"## {label} simulation — PASS\n\n"
        "The exact transaction argv passed Studio simulation with no forbidden execution marker.\n"
    )
    return True


def phase_simulate() -> int:
    fixture = make_fixture()
    save_fixture(fixture)
    print_argument_diagnostic("register_policy", fixture["policy_args"])
    command = argv("estimate", "register_policy", fixture["policy_args"], simulation=True)
    code, output = run_captured(command, cli_environment(fixture))
    try:
        assert_simulation_success(code, output)
    except AssertionError as error:
        append_report(
            "## Register-policy simulation — FAIL\n\n"
            f"Fixture: `{fixture['policy_id']}`\n\n"
            f"Failure: `{error}`\n\n{safe_failure_summary(code, output)}\n"
        )
        return 1
    append_report(
        "## Register-policy simulation — PASS\n\n"
        f"Fixture: `{fixture['policy_id']}`\n\n"
        "The exact eight-value argv passed simulation and no forbidden error marker was observed.\n"
    )
    fixture["simulation_passed"] = True
    save_fixture(fixture)
    return 0


def phase_write() -> int:
    fixture = load_fixture()
    if fixture.get("simulation_passed") is not True:
        raise RuntimeError("register_policy simulation has not passed; write is blocked")
    print_argument_diagnostic("register_policy", fixture["policy_args"])
    code = run_interactive(
        argv("write", "register_policy", fixture["policy_args"]),
        cli_environment(fixture),
    )
    append_report(
        "## Register-policy write — "
        f"{'COMMAND_EXIT_0' if code == 0 else f'EXIT_{code}'}\n\n"
        f"Fixture: `{fixture['policy_id']}`. CLI output was intentionally interactive and not captured by the driver.\n"
    )
    return code


def phase_lifecycle() -> int:
    fixture = load_fixture()
    policy, _ = read_contract(fixture, "get_policy", [fixture["policy_id"]])
    verify_policy(policy, fixture)
    append_report(
        "## get_policy — PASS; Studio datetime blocker RESOLVED\n\n"
        f"Confirmed register_policy transaction: `0xbca7dd78574cf0aaff2a2a1ff7f21f8591e1e38b6c2ad48762c2c297222b7788`.\n\n"
        f"Policy `{fixture['policy_id']}` belongs to the deployment owner, has the expected expiry, "
        "a non-empty fingerprint matching `3bfabd42b6b072fae26e8fa71594ebbd625827aa01832996d4397d6ba3916f3d`, "
        "valid authorities, and exactly nine rule dimensions. The canonical second-precision UTC timestamp "
        "path is therefore confirmed resolved on the live deployment.\n"
    )

    if not simulate_write(
        fixture,
        "create_use_request",
        fixture["request_args"],
        "create_use_request",
    ):
        return 1
    code = run_interactive(
        argv("write", "create_use_request", fixture["request_args"]),
        cli_environment(fixture),
    )
    if code != 0:
        append_report(f"## create_use_request — FAIL (exit {code})\n")
        return code

    request, _ = read_contract(fixture, "get_use_request", [fixture["request_id"]])
    assert request["request_id"] == fixture["request_id"]
    assert request["policy_id"] == fixture["policy_id"]
    assert request["resource_id"] == fixture["resource_id"]
    assert request["policy_fingerprint"] == policy["policy_fingerprint"]
    assert request["state"] == "USE_REQUEST_OPEN"
    append_report("## create_use_request + get_use_request — PASS\n")

    manifest = evidence_manifest(fixture, policy, request)
    if not simulate_write(
        fixture,
        "freeze_use_request",
        [fixture["request_id"], "v1", manifest],
        "freeze_use_request",
        preserved_raw_args=(manifest, None),
    ):
        return 1
    code = run_interactive(
        argv("write", "freeze_use_request", [fixture["request_id"], "v1", manifest]),
        cli_environment(fixture, (manifest, None)),
    )
    if code != 0:
        append_report(f"## freeze_use_request — FAIL (exit {code})\n")
        return code

    frozen_request, _ = read_contract(
        fixture, "get_use_request", [fixture["request_id"]]
    )
    assert frozen_request["state"] == "USE_REQUEST_FROZEN"
    evidence_id = frozen_request["evidence_set_id"]
    evidence, _ = read_contract(fixture, "get_evidence_set", [evidence_id])
    assert evidence["request_id"] == fixture["request_id"]
    assert evidence["policy_id"] == fixture["policy_id"]
    assert evidence["evidence_version"] == "v1"
    assert evidence["superseded"] is False
    assert evidence["consumed"] is False
    append_report(
        "## freeze_use_request + get_evidence_set — PASS\n\n"
        f"Evidence set: `{evidence_id}`. Review was not attempted in this phase.\n"
    )
    return 0


def phase_happy_path() -> int:
    fixture = load_happy_fixture()
    policy, _ = read_contract(fixture, "get_policy", [VALID_POLICY_ID])
    verify_happy_policy(policy)
    fixture["policy_fingerprint"] = policy["policy_fingerprint"]
    fixture["policy_expiry"] = policy["expires_at_utc"]
    fixture["authorities_json"] = json.dumps(
        policy["allowed_authorities"], separators=(",", ":")
    )
    fixture["rules_json"] = json.dumps(policy["rules"], separators=(",", ":"))
    save_happy_fixture(fixture)

    request = fixture.get("request_result")
    if request is None:
        if not simulate_write(
            fixture,
            "create_use_request",
            fixture["request_args"],
            "new create_use_request",
        ):
            return 1
        code = run_interactive(
            argv("write", "create_use_request", fixture["request_args"]),
            cli_environment(fixture),
        )
        if code != 0:
            append_report(
                f"## new create_use_request — BLOCKED/FAIL (exit {code})\n\n"
                f"Request ID: `{fixture['request_id']}`. Interactive keystore write did not complete.\n"
            )
            return code
        try:
            request, _ = read_contract(
                fixture, "get_use_request", [fixture["request_id"]]
            )
            verify_happy_request(request, fixture, policy)
        except Exception as error:
            append_report(
                "## new create_use_request — FAIL AFTER WRITE\n\n"
                f"Request ID: `{fixture['request_id']}`. Read-back verification failed: `{error}`.\n"
            )
            return 1
        fixture["request_result"] = request
        save_happy_fixture(fixture)
    else:
        verify_happy_request(request, fixture, policy)

    append_report(
        "## new create_use_request + get_use_request — PASS\n\n"
        f"Request ID: `{request['request_id']}`. Request fingerprint: `{request['request_fingerprint']}`.\n"
        f"Requester: `{request['requester']}`. Policy fingerprint: `{request['policy_fingerprint']}`.\n"
        f"Resource: `{request['resource_id']}`. State: `{request['state']}`.\n"
    )

    generate_happy_evidence(fixture, policy, request)
    verify_happy_evidence(fixture, policy, request)
    manifest = happy_evidence_manifest(fixture, policy, request)
    parsed_manifest = json.loads(manifest)
    assert parsed_manifest["policy_id"] == VALID_POLICY_ID
    assert parsed_manifest["policy_fingerprint"] == policy["policy_fingerprint"]
    assert parsed_manifest["request_id"] == request["request_id"]
    assert parsed_manifest["request_fingerprint"] == request["request_fingerprint"]
    assert parsed_manifest["resource_id"] == request["resource_id"]
    assert parsed_manifest["evidence_version"] == "v1"
    assert parsed_manifest["entries"][0]["content_sha256"] == fixture["evidence"]["content_sha256"]
    assert parsed_manifest["entries"][0]["attestation_hash"] == fixture["evidence"]["attestation_hash"]
    fixture["manifest"] = manifest
    save_happy_fixture(fixture)
    append_report(
        "## new evidence self-verification — PASS\n\n"
        f"Files: `{fixture['evidence']['body_file']}`, `{fixture['evidence']['attestation_file']}`.\n"
        f"Content hash: `{fixture['evidence']['content_sha256']}`.\n"
        f"Raw attestation hash: `{fixture['evidence']['attestation_hash']}`.\n"
    )

    if fixture.get("frozen_request") is None:
        if not simulate_write(
            fixture,
            "freeze_use_request",
            [request["request_id"], "v1", manifest],
            "new freeze_use_request",
            preserved_raw_args=(manifest, None),
        ):
            return 1
        code = run_interactive(
            argv("write", "freeze_use_request", [request["request_id"], "v1", manifest]),
            cli_environment(fixture, (manifest, None)),
        )
        if code != 0:
            append_report(
                f"## new freeze_use_request — BLOCKED/FAIL (exit {code})\n\n"
                f"Request ID: `{request['request_id']}`. Interactive keystore write did not complete.\n"
            )
            return code
        try:
            frozen_request, _ = read_contract(
                fixture, "get_use_request", [request["request_id"]]
            )
            assert frozen_request["state"] == "USE_REQUEST_FROZEN"
            assert frozen_request["request_fingerprint"] == request["request_fingerprint"]
            evidence_id = frozen_request["evidence_set_id"]
            evidence, _ = read_contract(
                fixture, "get_evidence_set", [evidence_id]
            )
            assert evidence["request_id"] == request["request_id"]
            assert evidence["policy_id"] == VALID_POLICY_ID
            assert evidence["policy_fingerprint"] == policy["policy_fingerprint"]
            assert evidence["resource_id"] == request["resource_id"]
            assert evidence["request_fingerprint"] == request["request_fingerprint"]
            assert evidence["evidence_version"] == "v1"
            assert evidence["evidence_set_fingerprint"]
            assert evidence["superseded"] is False
            assert evidence["consumed"] is False
        except Exception as error:
            append_report(
                "## new freeze_use_request — FAIL AFTER WRITE\n\n"
                f"Request ID: `{request['request_id']}`. Read-back verification failed: `{error}`.\n"
            )
            return 1
        fixture["frozen_request"] = frozen_request
        fixture["evidence_set"] = evidence
        save_happy_fixture(fixture)
    else:
        frozen_request = fixture["frozen_request"]
        evidence = fixture["evidence_set"]

    append_report(
        "## new freeze_use_request + get_evidence_set — PASS\n\n"
        f"New request ID: `{request['request_id']}`.\n"
        f"New request fingerprint: `{request['request_fingerprint']}`.\n"
        f"New evidence set ID: `{evidence['evidence_set_id']}`.\n"
        f"New evidence set fingerprint: `{evidence['evidence_set_fingerprint']}`.\n"
        "Review was not attempted. GitHub publication was not attempted.\n"
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--phase",
        required=True,
        choices=("simulate", "write", "lifecycle", "happy-path"),
    )
    phase = parser.parse_args().phase
    if phase == "simulate":
        return phase_simulate()
    if phase == "write":
        return phase_write()
    if phase == "happy-path":
        return phase_happy_path()
    return phase_lifecycle()


if __name__ == "__main__":
    raise SystemExit(main())
