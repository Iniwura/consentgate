import importlib
import importlib.util
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest

from gltest.direct import wasi_mock
from gltest.direct.vm import VMContext


CONTRACT_PATH = Path(__file__).resolve().parents[1] / "contracts" / "consent_gate.py"
EXACT_SDK = Path(
    "/home/ini/.cache/gltest-direct/extracted/vstudio-dev/"
    "py-lib-genlayer-std/kzr02ndm9et4qkmbqpq5djjt5sme2yt76n7sz1qbzax0knt6mam0"
)


def _load_exact_contract():
    for name in list(sys.modules):
        if name == "genlayer" or name.startswith("genlayer."):
            del sys.modules[name]

    vm = VMContext()
    vm._sender = bytes.fromhex("a35dc047f9937bf668743efbdf8ea93b31a55888")
    vm._origin = vm._sender
    vm._contract_address = bytes.fromhex("ec692ce47aa097261d1c43049fef230737d8eabf")
    wasi_mock.set_vm(vm)
    sys.modules["_genlayer_wasi"] = wasi_mock
    sys.path.insert(0, str(EXACT_SDK))

    from genlayer import calldata
    from genlayer.types import Address

    message = {
        "contract_address": Address(vm._contract_address),
        "sender_address": Address(vm._sender),
        "origin_address": Address(vm._origin),
        "signer_address": Address(vm._sender),
        "stack": [],
        "value": 0,
        "datetime": "2026-09-19T13:08:01Z",
        "is_init": False,
        "chain_id": 1,
        "entry_kind": 0,
        "entry_data": b"",
        "entry_stage_data": None,
    }
    encoded = calldata.encode(message)
    original_stdin = os.dup(0)
    fd, temp_path = __import__("tempfile").mkstemp()
    try:
        os.write(fd, encoded)
        os.lseek(fd, 0, os.SEEK_SET)
        os.dup2(fd, 0)
        os.close(fd)
        os.unlink(temp_path)

        spec = importlib.util.spec_from_file_location("_consentgate_datetime_contract", CONTRACT_PATH)
        assert spec is not None and spec.loader is not None
        module = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = module
        spec.loader.exec_module(module)
    finally:
        os.dup2(original_stdin, 0)
        os.close(original_stdin)

    return module.ConsentGate(), importlib.import_module("genlayer.message")


@pytest.fixture(scope="module")
def exact_contract():
    return _load_exact_contract()


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("2026-09-19T13:08:01Z", "2026-09-19T13:08:01Z"),
        ("2026-09-19T13:08:01+00:00", "2026-09-19T13:08:01Z"),
        ("2026-09-19T13:08:01.123456+00:00", "2026-09-19T13:08:01Z"),
        ("2026-09-19T13:10:22.346886+00:00", "2026-09-19T13:10:22Z"),
        ("2026-09-19T14:08:01+01:00", "2026-09-19T13:08:01Z"),
    ],
)
def test_now_normalizes_studio_system_timestamps(exact_contract, raw, expected):
    gate, message = exact_contract
    message.raw["datetime"] = raw
    assert gate._now().isoformat(timespec="seconds").replace("+00:00", "Z") == expected
    assert gate._now_string() == expected


@pytest.mark.parametrize(
    "raw",
    ["not-a-timestamp", "2026-09-19T13:08:01"],
)
def test_now_rejects_malformed_or_timezone_naive_system_timestamps(exact_contract, raw):
    gate, message = exact_contract
    message.raw["datetime"] = raw
    with pytest.raises(Exception):
        gate._now()


def test_user_timestamp_validation_remains_canonical(exact_contract):
    gate, _ = exact_contract
    with pytest.raises(Exception):
        gate._utc("2026-09-19T13:08:01+00:00", "user timestamp")
    with pytest.raises(Exception):
        gate._utc("2026-09-19T13:08:01.123456Z", "user timestamp")
    gate._utc("2026-09-19T13:08:01Z", "user timestamp")
