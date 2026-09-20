# ConsentGate architecture

ConsentGate is a contract-only, fail-closed data-use authorization protocol. A policy owner registers an immutable policy and evidence authority allowlist. A requester freezes an exact use request and an immutable evidence manifest. GenLayer validators independently fetch and evaluate that snapshot. A capability is issued only after a finalized `AUTHORIZED` result and is recipient-bound and single-use.

## Components and trust boundaries

The contract is the source of truth for policy, request, evidence, review, and capability state. The requester and policy owner supply data, but neither can mutate a frozen record in place. Registered evidence authorities publish source material and attestations; they are not trusted to choose the decision. HTTP responses and model output are untrusted inputs. GenLayer's leader and validators independently execute the nondeterministic review closure.

The editorial frontend in `frontend/` is a read-first Studio Dev client. Client
code must calculate absolute UTC deadlines and must read the latest available
state when a recent transaction is being inspected. The authoritative Studio
Dev deployment is `0xF12088c0feaF760c6Bc8F3E5A5a445A82ae08eEc`; the older
`0xC867A1E2374E133eb62448b22BcFB0E481cf9055` deployment is superseded.

## Review boundary

`review_use` snapshots all policy, request, and evidence fields into ordinary memory before invoking exactly one `gl.vm.run_nondet_unsafe` consensus closure. The leader closure:

1. recomputes the policy, request, and evidence fingerprints;
2. validates consent and all deadline bindings;
3. fetches each evidence source and authority attestation;
4. checks status classes, byte limits, hashes, exact attestation identity, timestamps, and allowlisted HTTPS origins;
5. asks the model for an exact JSON object about the frozen policy and request;
6. derives the decision from exact booleans and registered rule order.

The validator rejects non-return results, validates the leader result, independently reruns the closure, validates that result, and compares every key in `RESULT_KEYS`. No confidence score, prose explanation, or selected subset of fields can satisfy consensus. Storage is changed only after the consensus call returns.

Policy text, request fields, manifest fields, fetched evidence, and attestation bodies are explicitly delimited as untrusted data. Instructions in those values cannot redefine the protocol, authorize themselves, request tools, or change the output schema.

## Stored records

`PolicyRecord` stores the owner, resource, policy text/version, policy deadline, canonical authority allowlist, canonical rule definitions, evidence-age bound, fingerprint, and lifecycle flags.

`UseRequestRecord` stores the requester, policy/resource binding, purpose, data category, recipient, request and retention deadlines, sharing mode, commercial-use boolean, replay nonce, policy/request fingerprints, evidence binding, state, review-attempt count, result and result fingerprint, and optional capability id.

`EvidenceSetRecord` is append-only by evidence version. It stores a canonical sorted manifest, globally reserved claim keys, and a fingerprint bound to the exact request. Repair supersedes and consumes the previous set; finalized, cancelled, expired, or superseded sets cannot be reviewed again.

`CapabilityRecord` binds a capability to the request, policy, evidence set, finalized result, requester, resource, purpose, data category, recipient, sharing mode, commercial-use constraint, and the minimum of all applicable deadlines. Consumption stores a presentation-nonce hash and changes the capability to a terminal state.

## Fingerprint domains

All fingerprints are SHA-256 over canonical JSON material with a versioned domain label:

- `CG-POLICY-V2`: policy id, owner, resource, text, version, expiry, authority JSON, rules JSON, evidence-age limit;
- `CG-REQUEST-V2`: request fields, policy fingerprint, requester, and replay nonce;
- `CG-EVIDENCE-SET-V2`: request id, request fingerprint, evidence version, canonical manifest;
- `CG-CAPABILITY-RECORD-V2`: capability record and exact use constraints;
- `CG-EVIDENCE-CLAIM-V2`: policy/resource/authority/evidence identity and version;
- `CG-REQUEST-REPLAY-V2`: policy fingerprint, resource, requester, and replay nonce;
- `CG-PRESENTATION-V2`: capability id and presentation nonce.

The review closure recomputes its three input bindings. Any mismatch is non-authorizing. Capability issuance also binds the finalized result fingerprint, and every consumption validates the stored capability fingerprint and all exact constraints.

## Evidence model

Each manifest has exactly the `consentgate.v2` schema and at least one required entry. Entries contain evidence identity/version, authority identity, source and attestation URLs, content and attestation SHA-256 hashes, issued/expiry timestamps, and a required flag. A policy supplies the only accepted authority ids, key ids, HTTPS origins, and attestation path prefixes.

Evidence and attestation bodies are capped at 65,536 and 16,384 bytes respectively before prompt construction. This is a fail-closed resource bound, not a security shortcut. The source and attestation are fetched separately with `gl.nondet.web.get`. Hash, identity, timestamp, URL, empty-body, or allowlist failures require evidence repair. HTTP timeouts, rate limiting, server failures, and fetch/model failures are retryable. The request's retry budget is three review attempts.

## Exact semantic result

Every consensus result has exactly these keys:

`schema_version`, `result_kind`, `review_status`, `decision`, `policy_id`, `policy_fingerprint`, `request_id`, `request_fingerprint`, `resource_id`, `requester`, `evidence_set_id`, `evidence_set_fingerprint`, `review_revision`, `policy_binding_valid`, `purpose_allowed`, `data_category_allowed`, `recipient_allowed`, `retention_allowed`, `sharing_allowed`, `commercial_use_allowed`, `evidence_sufficient`, `consent_unexpired`, `violated_rule_ids`, and `error_code`.

`result_kind` is `DECISION`, `REPAIR`, or `RETRY`. `review_status` is `AUTHORIZED`, `DENIED`, `EVIDENCE_REPAIR_REQUIRED`, or `REVIEW_RETRY_REQUIRED`. `decision` is `AUTHORIZE` or `DENY`. A decision is derived from the booleans and the registered rule order; every false dimension must appear in `violated_rule_ids`. Repair and retry results are always `DENY`, contain no violated rule ids, and contain a non-empty error code. No confidence field exists.

## Time model

Deadlines are client-supplied, canonical second-precision UTC strings. They are immutable once stored and bounded by their parent policy/request window. Review uses the transaction datetime exposed by the GenVM message; if it is unavailable or malformed, the call fails closed. The model never supplies or rewrites the current time.

Policy, request, and capability expiry is permissionless. Synchronizing paths mark records expired and consume bound evidence where applicable. Explicit expiry operations are also permissionless. Revocation is owner-controlled for policies and capabilities. A caller cannot cancel a request after the request deadline has synchronized it to `EXPIRED`.

## Deployment status

ConsentGate is deployed and verified on Studio Devnet (chain `61997`). The
corrected deployment finalized as `ACCEPTED` /
`FINISHED_WITH_RETURN`, exposes 17 public methods, and matches the local source
byte-for-byte. The previous deployment remains historical and superseded; the
final lifecycle report records the live happy path and its known limitations.
