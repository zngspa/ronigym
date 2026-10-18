import { describe, it as test } from "node:test";
import { strict as assert } from "node:assert";
import { israelToday, medicalApprovalStatus, medicalExpiryStatus, medicalExpiryReminder } from "./medical-approval-status";

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

describe("medical expiry reminders", () => {
  test("warns exactly 30 days before expiry", () => {
    assert.equal(medicalExpiryStatus(true, "2026-11-18", "2026-10-19"), "expiring");
  });
  test("does not warn 31 days before expiry", () => {
    assert.equal(medicalExpiryStatus(true, "2026-11-19", "2026-10-19"), "valid");
  });
  test("expiry day is a renewal warning, not expired", () => {
    assert.equal(medicalExpiryStatus(true, "2026-10-19", "2026-10-19"), "expiring");
  });
  test("past expiry requires a new approval", () => {
    assert.equal(medicalExpiryStatus(true, "2026-10-18", "2026-10-19"), "expired");
    assert.notEqual(medicalExpiryReminder(true, "2026-10-18", "2026-10-19"), null);
  });
  test("unapproved records never become approaching-expiry approvals", () => {
    assert.equal(medicalExpiryStatus(false, "2026-10-20", "2026-10-19"), "unapproved");
  });
  test("missing expiry does not generate an expiry reminder", () => {
    assert.equal(medicalExpiryReminder(true, null, "2026-10-19"), null);
  });
  test("uses Israel date when UTC is still the previous day", () => {
    assert.equal(israelToday(new Date("2026-10-18T21:56:00Z")), "2026-10-19");
  });
});