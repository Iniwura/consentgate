# ConsentGate

ConsentGate proves that a specific use of data has permission behind it before access is released. It turns consent into a verifiable, single-use access decision: REQUEST USE → PROVE CONSENT → CHECK PERMISSION → CREATE ACCESS PASS → USE ACCESS.

## Problem

Ordinary application authorization often trusts a mutable database row, a single service, or a model-generated yes/no answer. That leaves policy substitution, evidence replay, stale evidence, prompt injection, validator disagreement, and capability theft difficult to detect. ConsentGate binds every authorization decision to immutable policy, request, evidence, and result fingerprints.

## Why GenLayer

The review must use external evidence and semantic evaluation while remaining deterministic at the protocol boundary. GenLayer supplies leader/validator execution for nondeterministic web and model calls. ConsentGate uses `gl.vm.run_nondet_unsafe` with a leader closure and a validator that independently reruns the closure and compares every field. A normal EVM contract could store hashes, but it could not itself perform this agreed semantic evidence review.

## Architecture

The canonical contract is [`contracts/consent_gate.py`](contracts/consent_gate.py). It stores:

- policies with owner, expiry, canonical authority allowlists, nine ordered rule dimensions, and a fingerprint;
- use requests with exact purpose, resource, recipient, sharing, commercial-use, deadlines, replay nonce, and bindings;
- append-only evidence sets with source/attestation hashes, authority bindings, timestamps, byte bounds, and globally reserved claim keys;
- capabilities bound to a finalized result and exact use constraints.

The full design is in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), the threat analysis is in [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md), and all legal transitions are in [`docs/STATE_MACHINE.md`](docs/STATE_MACHINE.md).

## Lifecycle

1. The owner calls `register_policy`.
2. A requester calls `create_use_request` with immutable deadlines and a fresh replay nonce.
3. The requester calls `freeze_use_request` with a canonical `consentgate.v2` evidence manifest.
4. `review_use` verifies evidence and obtains exact semantic consensus. Evidence failures are repairable; infrastructure/model failures are retryable; three review attempts are allowed.
5. Only finalized `AUTHORIZED` requests can call `issue_capability`.
6. The requesting agent presents exact constraints and a fresh nonce to `consume_capability` once.
7. Revocation, expiry, cancellation, repair, and terminal state rules prevent reuse.

## Evidence and semantic consensus

Evidence URLs must match a policy's exact HTTPS authority origin and attestation path. Source and attestation bytes are independently hashed and identity-checked. Source/attestation failures are never silently treated as authorization. Evidence bodies are capped at 65,536 bytes and attestation bodies at 16,384 bytes before they enter the evaluator prompt.

The consensus result has exactly 24 keys: `schema_version`, `result_kind`, `review_status`, `decision`, `policy_id`, `policy_fingerprint`, `request_id`, `request_fingerprint`, `resource_id`, `requester`, `evidence_set_id`, `evidence_set_fingerprint`, `review_revision`, eight rule booleans (`policy_binding_valid`, `purpose_allowed`, `data_category_allowed`, `recipient_allowed`, `retention_allowed`, `sharing_allowed`, `commercial_use_allowed`, `evidence_sufficient`), `consent_unexpired`, `violated_rule_ids`, and `error_code`. `AUTHORIZED` requires all consequential booleans true, exact bindings, empty violations, and an empty error code. There is no confidence score.

## Capability model

Capabilities are issued only to the requester after finalized authorization. The record binds policy, request, evidence, result fingerprint, requester, resource, purpose, category, recipient, sharing mode, commercial-use, and the minimum applicable expiry. Consumption requires the recipient address and every exact constraint, then stores `CG-PRESENTATION-V2(capability_id, presentation_nonce)` and moves the capability to `CAPABILITY_CONSUMED`. A second presentation cannot succeed. Policy revocation, expiry, owner revocation, and permissionless expiry are fail-closed terminal paths.

## Security boundaries

The contract does not trust requesters, policy owners' mutable inputs after registration, evidence publishers, HTTP response bodies, attestations, or model output. Fingerprints detect substitution; authority allowlists constrain provenance; timestamps and expiry prevent stale use; replay keys prevent reuse; exact result comparison prevents validator disagreement; and no capability is created from `DENIED`, `REPAIR`, `RETRY`, expired, revoked, cancelled, or unreviewed state. `ACCEPTED` is not treated as application finality: clients must inspect the returned state/result and read recent state using the network's latest-nonfinal read option where supported.

## Local verification

The project pins the host verification tools in [`requirements.txt`](requirements.txt) and [`pyproject.toml`](pyproject.toml). The contract's exact GenVM dependency header is:

```text
# { "Depends": "py-genlayer:5jycgeq4k8j23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
```

After installing the pinned requirements in the project environment, run:

```text
python scripts/preflight.py
```

The preflight runs lint/semantic validation, strict Pyright typecheck, schema extraction, and the 59-test ConsentGate Direct Mode suite against `contracts/consent_gate.py` (67 tests including the datetime compatibility tests).

## Current deployment status

The authoritative deployment is on GenLayer Studio Devnet (`studio-dev`, chain
`61997`, RPC `https://studio-dev.genlayer.com/api`):

`0xF12088c0feaF760c6Bc8F3E5A5a445A82ae08eEc`

The deployment transaction is
`0x271b1cdd4003e66ab6ae46be4ef905080bc3ac9b7b297879d7fb105337912411` and
finalized as `ACCEPTED` / `FINISHED_WITH_RETURN`. The deployed source matches
the local contract byte-for-byte and exposes 17 public methods. The previous
deployment `0xC867A1E2374E133eb62448b22BcFB0E481cf9055` is historical only and
is marked `SUPERSEDED AFTER LIVE REVIEW DIAGNOSIS`.

The corrected Studio Dev happy path is recorded in
[`artifacts/STUDIO_DEV_FINAL_TEST_REPORT.md`](artifacts/STUDIO_DEV_FINAL_TEST_REPORT.md)
and [`artifacts/STUDIO_DEV_HAPPY_PATH_FIXTURE.json`](artifacts/STUDIO_DEV_HAPPY_PATH_FIXTURE.json):
policy registration, request creation, evidence freeze, semantic review,
capability issuance, and single-use capability consumption all completed with
the final request and capability states read back from Studio Dev.

## Frontend application

The live application is [consentgate.vercel.app](https://consentgate.vercel.app).
The source lives in [`frontend`](frontend) and is a working ConsentGate product
surface, not a simulated dashboard. It connects a Studio Dev wallet, reads
latest-nonfinal contract state, and exposes the real lifecycle through a
permission record:

1. `REQUEST USE` records WHO IS ASKING, WHAT DATA, WHY, WHO RECEIVES IT, HOW
   LONG, sharing, and commercial use.
2. `PROVE CONSENT` attaches and locks the consent proof and attestation.
3. `CHECK PERMISSION` reads the deployed review result and all nine rule
   dimensions: policy match, consent validity, purpose, data category,
   recipient, retention, sharing, commercial use, and proof validity.
4. `CREATE ACCESS PASS` is available only for an onchain `AUTHORIZED` request.
5. `USE ACCESS` consumes the exact pass once with its presentation nonce.

The interface presents friendly labels such as `ACCESS APPROVED` while keeping
the canonical contract state and protocol identifiers available under protocol
details. Writes use the installed `genlayer-js@2.0.0-rc.1` integration with
estimate → simulate → wallet approval → one submission → accepted-consensus
receipt → `FINISHED_WITH_RETURN` → latest-nonfinal state confirmation. A
submitted hash is retained so the user can check status without creating a
duplicate write.

For local use:

```text
cd frontend
npm install
npm run dev
```

The defaults in `frontend/lib/config.ts` and `frontend/.env.example` point to
the corrected Studio Dev contract and the authoritative policy/request fixture.
Production/demo configuration can override them with
`NEXT_PUBLIC_GENLAYER_RPC`, `NEXT_PUBLIC_GENLAYER_CHAIN_ID`,
`NEXT_PUBLIC_CONTRACT_ADDRESS`, `NEXT_PUBLIC_DEMO_POLICY_ID`, and
`NEXT_PUBLIC_DEMO_REQUEST_ID`.

Known limitations: browser wallet availability is required for writes, public
evidence URLs must remain reachable for permission review, and the UI does not
invent chain state when a read or transaction is pending.

Submission checks: the frontend includes focused runtime tests for the
transaction watcher, lifecycle gates, evidence version binding, wallet state,
capability single-use behavior, and product-state presentation. The contract
verification remains the 67-test preflight recorded above. Run the frontend
checks with:

```text
cd frontend
npm test
npm run lint
npm run build
rm -rf .output .vercel/output
VERCEL=1 NITRO_PRESET=vercel npx vite build
```
