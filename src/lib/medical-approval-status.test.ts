import { describe, expect, test } from "bun:test";
import { medicalApprovalStatus } from "./medical-approval-status";

describe("medical approval history status", () => {
  test("an unapproved record stays unapproved even with a future expiry", () => {
    expect(medicalApprovalStatus(false, "2027-01-01", "2026-10-18")).toBe("unapproved");
  });
  test("an approval is valid through its expiry date", () => {
    expect(medicalApprovalStatus(true, "2026-10-18", "2026-10-18")).toBe("valid");
  });
  test("past expiry is expired", () => {
    expect(medicalApprovalStatus(true, "2026-10-17", "2026-10-18")).toBe("expired");
  });
  test("an approval without expiry cannot be called valid", () => {
    expect(medicalApprovalStatus(true, null, "2026-10-18")).toBe("unknown");
  });
});