"""Run ConsentGate's deterministic local verification gates."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "contracts" / "consent_gate.py"
TEST = ROOT / "tests" / "test_consent_gate.py"
GENVM_VERSION = "vstudio-dev"
EXPECTED_PUBLIC_METHOD_COUNT = 17


def resolve_tool(name: str) -> Path:
    env_name = "CONSENTGATE_" + name.upper().replace("-", "_")
    configured = os.environ.get(env_name)
    candidates = [Path(configured)] if configured else []
    candidates.append(ROOT / ".venv" / "bin" / name)
    candidates.append(Path(sys.executable).with_name(name))
    located = shutil.which(name)
    if located:
        candidates.append(Path(located))
    for candidate in candidates:
        if candidate and candidate.is_file() and os.access(candidate, os.X_OK):
            return candidate
    raise SystemExit(
        f"Missing {name}. Install requirements.txt in the project environment "
        f"or set {env_name}."
    )


def run_gate(label: str, command: list[str], env: dict[str, str]) -> None:
    print(f"\n=== {label} ===", flush=True)
    print("$ " + " ".join(command), flush=True)
    completed = subprocess.run(command, cwd=ROOT, env=env, text=True, check=False)
    if completed.returncode != 0:
        raise SystemExit(f"{label} failed with exit code {completed.returncode}.")


def run_studio_schema_gate() -> None:
    """Extract schema through the Studio SDK selected by the contract header."""
    sys.path.insert(0, str(ROOT))
    from gltest.direct import VMContext
    import gltest.direct.loader as direct_loader
    import tests.conftest as direct_compat

    direct_loader._inject_message_to_fd0 = direct_compat._inject_studio_message
    direct_loader._allocate_contract = direct_compat._allocate_studio_contract
    direct_loader._patch_run_nondet_for_direct_mode = lambda: direct_compat._install_studio_patches()

    vm = VMContext()
    vm.warp("2027-01-01T00:00:00Z")
    with vm.activate():
        contract = direct_loader.deploy_contract(CONTRACT, vm)
        import json

        schema = json.loads(contract.__get_schema__())
    methods = schema.get("methods", {})
    count = len(methods)
    print(f"Studio SDK schema public method count: {count}", flush=True)
    if count != EXPECTED_PUBLIC_METHOD_COUNT:
        raise SystemExit(
            f"Studio SDK schema expected {EXPECTED_PUBLIC_METHOD_COUNT} public methods, got {count}."
        )


def main() -> int:
    if not CONTRACT.is_file() or not TEST.is_file():
        print("ConsentGate preflight: canonical contract or test file is missing.", file=sys.stderr)
        return 1

    genvm_lint = resolve_tool("genvm-lint")
    pyright = resolve_tool("pyright")
    env = os.environ.copy()
    tool_bin = str(genvm_lint.parent)
    pyright_bin = str(pyright.parent)
    env["PATH"] = os.pathsep.join([tool_bin, pyright_bin, env.get("PATH", "")])
    env["GENVM_VERSION"] = os.environ.get("CONSENTGATE_GENVM_VERSION", GENVM_VERSION)

    run_gate("genvm-lint version", [str(genvm_lint), "--version"], env)
    run_gate("pyright version", [str(pyright), "--version"], env)
    run_gate("lint", [str(genvm_lint), "lint", str(CONTRACT)], env)
    run_gate("strict typecheck", [str(genvm_lint), "typecheck", str(CONTRACT), "--strict"], env)
    print("\n=== Studio SDK schema extraction ===", flush=True)
    run_studio_schema_gate()
    run_gate("Direct Mode", [sys.executable, "-m", "pytest", "-q", str(TEST)], env)
    print("\nConsentGate preflight: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
