export function medicalApprovalStatus(approved: boolean, expiresOn: string | null, today: string) {
  if (!approved) return "unapproved";
  if (!expiresOn) return "unknown";
  return expiresOn < today ? "expired" : "valid";
}