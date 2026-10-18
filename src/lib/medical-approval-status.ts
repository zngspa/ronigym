export function medicalApprovalStatus(approved: boolean, expiresOn: string | null, today: string) {
  if (!approved) return "unapproved";
  if (!expiresOn) return "unknown";
  return expiresOn < today ? "expired" : "valid";
}

export const MEDICAL_EXPIRY_WARNING_DAYS = 30;

export function israelToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function medicalExpiryStatus(approved: boolean, expiresOn: string | null, today: string) {
  const status = medicalApprovalStatus(approved, expiresOn, today);
  if (status !== "valid" || !expiresOn) return status;
  const daysLeft = Math.round((Date.parse(`${expiresOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  return daysLeft <= MEDICAL_EXPIRY_WARNING_DAYS ? "expiring" : "valid";
}

export function medicalExpiryReminder(approved: boolean, expiresOn: string | null, today: string) {
  const status = medicalExpiryStatus(approved, expiresOn, today);
  if (status === "expired") return "האישור הרפואי פג תוקף — נדרש אישור חדש";
  if (status === "expiring" && expiresOn) {
    const days = Math.round((Date.parse(`${expiresOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
    return days === 0 ? "האישור הרפואי בתוקף עד היום — יש לחדש אותו" : `האישור הרפואי יפוג בעוד ${days} ימים — יש לחדש אותו`;
  }
  return null;
}