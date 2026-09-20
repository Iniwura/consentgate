import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canRepairState,
  canReviewState,
  canCompleteAfterStateConfirmation,
  capabilityCanConsume,
  canonicalUtcSecond,
  isAcceptedWithReturn,
  isFinishedWithReturn,
  isIssueCapabilityConfirmation,
  productStateLabel,
  shouldResubmitAfterHash,
  submittedFailureLabel,
  utcInputValue,
  versionedEvidence,
  walletStateFor,
} from "../lib/runtime.js";

test("only frozen and retry-required requests enable review", () => {
  assert.equal(canReviewState("USE_REQUEST_FROZEN"), true);
  assert.equal(canReviewState("REVIEW_RETRY_REQUIRED"), true);
  assert.equal(canReviewState("EVIDENCE_REPAIR_REQUIRED"), false);
});

test("evidence repair is enabled only for the repair state", () => {
  assert.equal(canRepairState("EVIDENCE_REPAIR_REQUIRED"), true);
  assert.equal(canRepairState("USE_REQUEST_FROZEN"), false);
});

test("v2 evidence binds the manifest and entry to v2", () => {
  assert.deepEqual(versionedEvidence("v2"), {
    evidence_version: "v2",
    entry_version: "v2",
  });
});

test("consumed capabilities cannot be consumed again", () => {
  assert.equal(capabilityCanConsume("CAPABILITY_ISSUED"), true);
  assert.equal(capabilityCanConsume("CAPABILITY_CONSUMED"), false);
});

test("issue_capability post-write confirmation requires issued capability state", () => {
  assert.equal(isIssueCapabilityConfirmation("issue_capability", "cap_test", "CAPABILITY_ISSUED"), true);
  assert.equal(isIssueCapabilityConfirmation("issue_capability", "", "CAPABILITY_ISSUED"), false);
  assert.equal(isIssueCapabilityConfirmation("issue_capability", "cap_test", "AUTHORIZED"), false);
  assert.equal(isIssueCapabilityConfirmation("issue_capability", "cap_test", "CAPABILITY_CONSUMED"), false);
});

test("wallet account and chain changes produce the correct UI state", () => {
  assert.equal(walletStateFor(null, null, 61997), "disconnected");
  assert.equal(walletStateFor("0xabc", 1, 61997), "wrong-network");
  assert.equal(walletStateFor("0xabc", 61997, 61997), "connected");
});

test("successful writes require the final return result", () => {
  assert.equal(isFinishedWithReturn(true, "FINISHED_WITH_RETURN"), true);
  assert.equal(isFinishedWithReturn(true, "FINISHED_WITH_ERROR"), false);
  assert.equal(isFinishedWithReturn(false, "FINISHED_WITH_RETURN"), false);
});

test("accepted consensus with a successful return can reach state confirmation", () => {
  assert.equal(isAcceptedWithReturn("ACCEPTED", true, "FINISHED_WITH_RETURN"), true);
  assert.equal(canCompleteAfterStateConfirmation({ accepted: true, executionSucceeded: true, stateConfirmed: true }), true);
});

test("accepted consensus with an unsuccessful execution cannot complete", () => {
  assert.equal(isAcceptedWithReturn("ACCEPTED", true, "FINISHED_WITH_ERROR"), false);
  assert.equal(canCompleteAfterStateConfirmation({ accepted: true, executionSucceeded: false, stateConfirmed: true }), false);
});

test("state readback is required before complete", () => {
  assert.equal(canCompleteAfterStateConfirmation({ accepted: true, executionSucceeded: true, stateConfirmed: false }), false);
});

test("a submitted hash is retained after polling timeout without resubmission", () => {
  assert.equal(submittedFailureLabel(true), "TRANSACTION SUBMITTED — CHECK STATUS");
  assert.equal(shouldResubmitAfterHash(), false);
});

test("product state presentation maps canonical state without changing it", () => {
  assert.equal(productStateLabel("CAPABILITY_CONSUMED"), "ACCESS USED");
  assert.equal(productStateLabel("REVIEW_RETRY_REQUIRED"), "PERMISSION CHECK NEEDS RETRY");
  assert.equal(productStateLabel("UNMAPPED_STATE"), "UNMAPPED_STATE");
});

test("UTC form values become second-precision contract timestamps", () => {
  assert.equal(canonicalUtcSecond("2026-09-20T08:17"), "2026-09-20T08:17:00Z");
  assert.equal(canonicalUtcSecond("2026-09-20T08:17:51Z"), "2026-09-20T08:17:51Z");
  assert.equal(utcInputValue("2026-09-20T08:17:51Z"), "2026-09-20T08:17");
});
