import { describe, it as test } from "node:test";
import { strict as assert } from "node:assert";
import { medicalApprovalStatus } from "./medical-approval-status";

describe("medical approval history status", () => {
  test("an unapproved record stays unapproved even with a future expiry", () => {
    assert.equal(medicalApprovalStatus(false, "2027-01-01", "2026-10-18"), "unapproved");
  });
  test("an approval is valid through its expiry date", () => {
    assert.equal(medicalApprovalStatus(true, "2026-10-18", "2026-10-18"), "valid");
  });
  test("past expiry is expired", () => {
    assert.equal(medicalApprovalStatus(true, "2026-10-17", "2026-10-18"), "expired");
  });
  test("an approval without expiry cannot be called valid", () => {
    assert.equal(medicalApprovalStatus(true, null, "2026-10-18"), "unknown");
  });
});