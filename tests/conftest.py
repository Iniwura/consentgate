"""Compatibility glue for the installed GenLayer Studio Direct Mode SDK.

The project pins ``genlayer-test`` for its Direct Mode VM, while the contract
header selects the Studio Dev standard library.  The installed test package
still imports the pre-Studio ``genlayer.py`` namespace.  Keep this adapter in
the test harness so production contract code is exercised against the SDK
selected by its runner header.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
from typing import Any

import gltest.direct.loader as direct_loader
from gltest.direct.vm import VMContext, _sentinel


def _inject_studio_message(vm: VMContext) -> None:
    """Inject one current-SDK message before importing a contract module."""
    from genlayer import calldata
    from genlayer.types import Address

    def address(value: Any) -> Address:
        if value is None:
            return Address(b"\x00" * Address.SIZE)
        if isinstance(value, Address):
            return value
        if isinstance(value, bytes):
            return Address(value)
        if hasattr(value, "as_bytes"):
            return Address(value.as_bytes)
        return Address(value)

    sender = address(vm.sender)
    contract = address(vm._contract_address)
    origin = address(vm.origin)
    message = {
        "contract_address": contract,
        "sender_address": sender,
        "origin_address": origin,
        "signer_address": sender,
        "stack": [],
        "value": vm._value,
        "datetime": vm._datetime,
        "is_init": False,
        "chain_id": vm._chain_id,
        "entry_kind": 0,
        "entry_data": b"",
        "entry_stage_data": None,
    }
    encoded = calldata.encode(message)
    fd, path = tempfile.mkstemp()
    try:
        os.write(fd, encoded)
        os.lseek(fd, 0, os.SEEK_SET)
        original_stdin = os.dup(0)
        vm._original_stdin_fd = original_stdin
        os.dup2(fd, 0)
    finally:
        os.close(fd)
        os.unlink(path)


def _allocate_studio_contract(contract_cls: type, vm: VMContext, *args: Any, **kwargs: Any) -> Any:
    """Allocate storage using the Studio SDK's current storage builder."""
    from genlayer.storage import ROOT_SLOT_ID
    from genlayer.storage._internal.generate import (
        ORIGINAL_INIT_ATTR,
        _BuilderCtx,
        _storage_build,
    )

    descriptor = _storage_build(_BuilderCtx.empty(), contract_cls)
    instance = descriptor.get(vm._storage.get_store_slot(ROOT_SLOT_ID), 0)
    init_owner = getattr(descriptor, "cls", None)
    init = getattr(init_owner, "__init__", None) if init_owner is not None else getattr(contract_cls, "__init__", None)
    if init is not None:
        if hasattr(init, ORIGINAL_INIT_ATTR):
            init = getattr(init, ORIGINAL_INIT_ATTR)
        init(instance, *args, **kwargs)
    return instance


def _studio_run_nondet(leader_fn, validator_fn, /, **kwargs):
    """Run the leader directly and retain its validator for VM tests."""
    from gltest.direct import wasi_mock

    vm = wasi_mock.get_vm()
    vm._in_nondet = True
    try:
        result = leader_fn()
    finally:
        vm._in_nondet = False
    vm._captured_validators.append((result, leader_fn, validator_fn))
    return result


def _studio_exec_prompt(prompt: str, /, **config):
    from gltest.direct import wasi_mock

    vm = wasi_mock.get_vm()
    response = vm._match_llm_mock(prompt)
    if response is None:
        raise RuntimeError(f"No LLM mock for prompt: {prompt[:100]}...")
    if config.get("response_format", "text") == "json" and isinstance(response, str):
        return json.loads(response)
    return response


def _studio_web_get(url: str, /, **kwargs):
    from gltest.direct import wasi_mock
    from genlayer.nondet.web import Response

    vm = wasi_mock.get_vm()
    mock = vm._match_web_mock(url, "GET")
    if mock is None:
        raise RuntimeError(f"No web mock for GET {url}")
    body = mock.get("body")
    if isinstance(body, str):
        body = body.encode("utf-8")
    return Response(status=mock.get("status", 200), headers={}, body=body)


def _refresh_studio_message(self: VMContext) -> None:
    """Refresh current-SDK message globals after sender/time changes."""
    if "genlayer.message" not in sys.modules:
        return
    from genlayer.types import Address

    def address(value: Any) -> Any:
        if value is None or isinstance(value, Address):
            return value
        if isinstance(value, bytes):
            return Address(value)
        if hasattr(value, "as_bytes"):
            return Address(value.as_bytes)
        return value

    message = sys.modules["genlayer.message"]
    sender = address(self.sender)
    origin = address(self.origin)
    message.sender_address = sender
    message.origin_address = origin
    message.value = self._value
    message.chain_id = self._chain_id
    message.datetime = self._datetime
    if isinstance(getattr(message, "raw", None), dict):
        message.raw.update(
            sender_address=sender,
            origin_address=origin,
            value=self._value,
            chain_id=self._chain_id,
            datetime=self._datetime,
        )


def _run_validator_studio(self: VMContext, *, leader_result: Any = _sentinel, leader_error: Exception | None = None, index: int = -1) -> bool:
    from genlayer import vm as gl_vm

    if not self._captured_validators:
        raise RuntimeError("No validator captured. Call a nondeterministic contract method first.")
    stored_result, leader_fn, validator_fn = self._captured_validators[index]
    if leader_error is not None:
        wrapped = gl_vm.UserError(str(leader_error))
    elif leader_result is not _sentinel:
        wrapped = gl_vm.Return(calldata=leader_result)
    else:
        wrapped = gl_vm.Return(calldata=stored_result)
    return validator_fn(wrapped)


direct_loader._inject_message_to_fd0 = _inject_studio_message
direct_loader._allocate_contract = _allocate_studio_contract
direct_loader._patch_run_nondet_for_direct_mode = lambda: _install_studio_patches()
VMContext._refresh_gl_message = _refresh_studio_message
VMContext.run_validator = _run_validator_studio


def _install_studio_patches() -> None:
    import genlayer.nondet as nondet
    import genlayer.nondet.web as web
    import genlayer.vm as vm

    vm.run_nondet = _studio_run_nondet
    nondet.exec_prompt = _studio_exec_prompt
    web.get = _studio_web_get
