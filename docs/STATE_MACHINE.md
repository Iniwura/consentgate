# ConsentGate state machine

This document describes the stored request state, policy lifecycle flags, evidence lifecycle, and capability lifecycle. A state is terminal when no public method can move that record to another state.

## Policy lifecycle

| Current | Operation | Next | Authority/guard |
|---|---|---|---|
| absent | `register_policy` | `POLICY_REGISTERED` | unique id; canonical policy; future expiry |
| `POLICY_REGISTERED` | `revoke_policy` | `POLICY_REVOKED` | policy owner; not already revoked/expired |
| `POLICY_REGISTERED` | `expire_policy` | `EXPIRED` | permissionless; current datetime is at/after expiry |

The stored policy uses `revoked` and `expired` flags. Views derive the effective policy state. Revoked and expired policies cannot accept new requests, freeze evidence, authorize a capability, or be used to consume a capability.

## Request lifecycle

```text
absent
  └─register_policy + create_use_request─> USE_REQUEST_OPEN
       ├─freeze_use_request (v1)────────> USE_REQUEST_FROZEN
       │                                  ├─review_use─> AUTHORIZED
       │                                  ├─review_use─> DENIED [terminal]
       │                                  ├─review_use─> REVIEW_RETRY_REQUIRED
       │                                  │                    ├─review_use (until 3 attempts)
       │                                  │                    └─cancel_use_request─> CANCELLED [terminal]
       │                                  └─review_use─> EVIDENCE_REPAIR_REQUIRED
       │                                                       └─repair_evidence (vN+1)
       │                                                            └─> USE_REQUEST_FROZEN
       ├─cancel_use_request───────────────────────────────────────> CANCELLED [terminal]
       └─expire_use_request (deadline passed)────────────────────> EXPIRED [terminal]

AUTHORIZED
  ├─issue_capability─────────────────────────────────────────────> CAPABILITY_ISSUED
  ├─expire_use_request (request deadline passed)─────────────────> EXPIRED [terminal]
  └─cancel_use_request───────────────────────────────────────────> rejected (final)

CAPABILITY_ISSUED
  ├─consume_capability───────────────────────────────────────────> CAPABILITY_CONSUMED [terminal]
  ├─revoke_capability────────────────────────────────────────────> REVOKED [terminal]
  └─expire_capability (capability deadline passed)───────────────> EXPIRED [terminal]
```

`USE_REQUEST_OPEN`, `USE_REQUEST_FROZEN`, `REVIEW_RETRY_REQUIRED`, `EVIDENCE_REPAIR_REQUIRED`, and `AUTHORIZED` are active request states before capability issuance. `DENIED`, `CANCELLED`, `EXPIRED`, `CAPABILITY_CONSUMED`, and `REVOKED` are terminal. `CAPABILITY_ISSUED` is active only for the capability path. Request expiry synchronization consumes any bound evidence set.

### Review rules

- `review_use` is legal only from `USE_REQUEST_FROZEN` or `REVIEW_RETRY_REQUIRED`.
- `DENIED` is final and cannot issue a capability or be reviewed again.
- A repair result is not directly reviewable; the requester must publish a strictly higher evidence version through `repair_evidence`.
- A retry result may be reviewed again until `MAX_REVIEW_ATTEMPTS == 3`.
- A finalized result consumes its evidence set. Repair consumes/supersedes the old evidence set.

## Capability lifecycle

| Current | Operation | Next | Authority/guard |
|---|---|---|---|
| no capability | `issue_capability` | `CAPABILITY_ISSUED` | requester; request is finalized `AUTHORIZED`; policy active |
| `CAPABILITY_ISSUED` | `consume_capability` | `CAPABILITY_CONSUMED` | issued recipient; exact constraints; fresh one-time presentation |
| `CAPABILITY_ISSUED` | `revoke_capability` | `REVOKED` | policy owner |
| `CAPABILITY_ISSUED` | `expire_capability` | `EXPIRED` | permissionless; deadline passed |
| any active capability | policy revocation | effective `REVOKED` | policy state is checked on read/use; consumption records terminal revocation |

No operation can reactivate a consumed, revoked, or expired capability. The request follows the capability terminal state so a request cannot be used to issue another capability.

## Evidence lifecycle

An evidence set is created as version `v1` during `freeze_use_request`. A repair creates a new strictly increasing `vN`, marks the old set `superseded` and `consumed`, and binds the request to the new set. Evidence claim keys remain reserved permanently, preventing replay under another request. Final review, cancellation, and expiry consume the currently bound set.

## Result states

The consensus result is one of:

- `DECISION` + `AUTHORIZED` + `AUTHORIZE`;
- `DECISION` + `DENIED` + `DENY`;
- `REPAIR` + `EVIDENCE_REPAIR_REQUIRED` + `DENY`;
- `RETRY` + `REVIEW_RETRY_REQUIRED` + `DENY`.

Every result carries exact policy/request/evidence bindings, review revision, nine booleans, ordered violated rule ids, and an error code. Decision results have an empty error code; repair/retry results have a non-empty error code and no violated rule ids.
