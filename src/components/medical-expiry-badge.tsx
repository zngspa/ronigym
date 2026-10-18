import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock } from "lucide-react";
import { useIsraelToday } from "@/hooks/use-israel-today";
import { medicalExpiryReminder, medicalExpiryStatus } from "@/lib/medical-approval-status";

export function MedicalExpiryBadge({ approved, expiresOn }: { approved: boolean; expiresOn: string | null }) {
  const today = useIsraelToday();
  if (!today) return null;
  const reminder = medicalExpiryReminder(approved, expiresOn, today);
  if (!reminder) return null;
  const expired = medicalExpiryStatus(approved, expiresOn, today) === "expired";
  const Icon = expired ? AlertTriangle : Clock;
  return <Badge variant="outline" className={`max-w-full whitespace-normal gap-1 mt-1 ${expired ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-warning-foreground/30 bg-warning text-warning-foreground"}`}>
    <Icon className="h-3.5 w-3.5 shrink-0" />{reminder}
  </Badge>;
}