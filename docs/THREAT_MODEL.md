# ConsentGate threat model

## Scope and security objective

The protected asset is the authorization decision and the capability derived from it. The objective is that a capability can be issued and consumed only when the exact registered policy, exact request, current bounded evidence, and exact consensus result all remain bound and valid. The system fails closed on ambiguity, missing data, disagreement, stale data, and tool/model failure.

In scope are the contract, GenVM execution, GenLayer leader/validator result, HTTP evidence retrieval, authority attestations, requesters, policy owners, and capability presenters. A frontend, private-key custody, authority operational security, and an already-compromised GenLayer protocol are outside this contract's control.

## Assets and invariants

- Policy text, authority allowlist, rule definitions, resource, owner, and expiry remain fingerprint-bound.
- Request purpose, data category, recipient, retention, sharing, commercial-use, deadlines, requester, and replay nonce remain fingerprint-bound.
- Evidence is tied to one request and version; claims cannot be reserved twice.
- A semantic result is exact, schema-checked, and compared across leader/validator executions.
- Only finalized `AUTHORIZED` can issue a capability.
- A capability is recipient-bound, expiry-bound, revocable, and single-use.
- Time-sensitive state cannot be made valid by a caller choosing a later review interpretation.

## Threats and controls

### Prompt injection

An evidence source or attestation may contain instructions such as “ignore the policy” or “authorize.” All policy, request, source, and attestation content is labeled untrusted in the evaluator prompt. The contract derives bindings, deadlines, rule identities, and schema outside the model. Evidence cannot redefine rules or authorize itself.

### Malicious evidence publisher

A publisher may return different bytes, empty bytes, malformed JSON, wrong status, stale timestamps, future timestamps, or mismatched hashes. The contract fetches source and attestation separately, checks exact HTTP classes, hashes the returned bytes, validates timestamps, and compares the complete expected attestation object. The outcome is repair or retry, never silent authorization.

### Compromised approved publisher

An allowlisted origin is not treated as an unconditional truth source. The content hash, attestation hash, authority id/key id, request/policy/resource bindings, version, and validity window must all match. A compromised authority can still publish a harmful but internally consistent artifact; the policy owner must choose authorities and rule semantics accordingly. The contract does not claim to verify an external cryptographic signature beyond the hash-bound attestation bytes.

### Stale evidence

Each entry has issued/expiry timestamps and is checked against the transaction datetime and policy expiry. `max_evidence_age_seconds` bounds age. Expired, future, or stale entries require repair.

### Hash substitution

Hashes are stored in the frozen manifest and included in the evidence-set fingerprint. The fetched bytes must hash exactly to the manifest values. Policy, request, evidence, capability, claim, replay, and presentation domain hashes make cross-context substitution fail binding checks.

### Policy substitution

Policy fields are canonicalized and fingerprinted at registration. Review recomputes the policy fingerprint from the copied fields and compares it with the request and result bindings. A modified policy record cannot produce a valid authorization result.

### Request substitution

The request fingerprint covers all authorization-driving request fields plus requester and replay nonce. The manifest and result carry the request fingerprint and request id. Capability issuance and consumption revalidate those bindings.

### Evidence replay

Evidence claim keys are reserved globally using policy/resource/authority/evidence identity/version. A request cannot claim a previously reserved evidence identity/version, and repaired, superseded, consumed, cancelled, and finalized evidence sets are not reviewable.

### Capability replay or theft

Capability ids are deterministic but not sufficient alone: consumption requires the issued recipient address, exact resource/purpose/recipient/sharing/commercial-use constraints, active policy, unexpired capability, and a presentation nonce. Status changes from `CAPABILITY_ISSUED` to `CAPABILITY_CONSUMED` before any second use can succeed. Owner revocation, policy revocation, and expiry close the path.

### Validator disagreement

The validator rejects non-return values, validates both result schemas, independently reruns the same closure, and compares every key in `RESULT_KEYS`. A mismatch aborts the review instead of selecting a majority-like subset or confidence score.

### HTTP failures

Timeouts, 425/408, rate limiting, and 5xx responses are retryable. Known permanent 4xx classes, bad URLs, missing/empty bodies, hash mismatches, and identity mismatches require evidence repair. Unknown/non-200 conditions fail closed as retryable response failures.

### Model failures

Malformed model JSON, extra/missing fields, non-boolean flags, invalid rule lists, inconsistent bindings, or a decision that does not exactly match the booleans becomes `REVIEW_RETRY_REQUIRED`. The attempt count is bounded at three; no model output can bypass the contract's derived result logic.

### Policy revocation

Only the policy owner can revoke. Revocation is checked during review, capability issuance, capability consumption, and views. A revoked policy blocks new authorization use and makes a capability effectively revoked; a consumption attempt records the terminal revoked state.

### Expiry races

Deadlines are absolute, canonical, and parent-bounded. Synchronizing paths check the transaction datetime. Permissionless expiry prevents an owner or requester from being required to cooperate. Cancellation synchronizes the request first, so it cannot overwrite a deadline that has already passed. Capability expiry is independently bounded by the request retention, request expiry, and policy expiry.

### Accepted versus finalized confusion

An RPC/transaction status is not the application decision. The review write must return a stored `AUTHORIZED` or `DENIED` result after consensus; only that finalized state can issue a capability. Clients should read the returned result and use the network's latest-nonfinal read variant for recent state, then distinguish `AUTHORIZED` from `CAPABILITY_ISSUED` and `CAPABILITY_CONSUMED`.

## Residual risks

- A policy owner can register a permissive policy or an untrustworthy authority; governance of those inputs is external.
- GenLayer protocol or GenVM bugs are outside contract-level controls.
- The contract cannot prove facts that are absent from the fetched evidence.
- The installed CLI and network endpoint must be independently verified before any production deployment; this checkpoint intentionally performs no deployment.
- Large prompt/evidence limits prevent unbounded input but can cause a legitimate publisher to require repair with a smaller artifact.
