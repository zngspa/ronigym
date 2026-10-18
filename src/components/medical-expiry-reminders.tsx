import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MedicalExpiryBadge } from "@/components/medical-expiry-badge";
import { useIsraelToday } from "@/hooks/use-israel-today";
import { medicalExpiryStatus } from "@/lib/medical-approval-status";

export function MedicalExpiryReminders() {
  const today = useIsraelToday();
  const { data: students = [], isPending, isError, refetch } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
    refetchInterval: 60_000,
  });
  const reminders = students.filter(student => {
    if (!today || student.active === false) return false;
    const status = medicalExpiryStatus(student.health_approval === true, student.health_approval_expiry, today);
    return status === "expired" || status === "expiring";
  }).sort((a, b) => (a.health_approval_expiry ?? "").localeCompare(b.health_approval_expiry ?? ""));

  return <section aria-label="תזכורות אישורים רפואיים" className="space-y-3 border-t pt-5">
    <h2 className="flex items-center gap-2 font-semibold text-lg"><Bell className="h-5 w-5 text-primary" />תזכורות אישורים רפואיים{reminders.length > 0 && <span className="text-sm text-muted-foreground">({reminders.length})</span>}</h2>
    {isPending || !today ? <p className="text-sm text-muted-foreground">בודק תוקף אישורים...</p> : isError ? <div className="flex items-center gap-2"><p className="text-sm text-destructive">לא ניתן לטעון את התזכורות</p><Button variant="outline" size="sm" onClick={() => refetch()}>נסה שוב</Button></div> : reminders.length === 0 ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4" />אין אישורים שפגו או שיפוגו ב־30 הימים הקרובים</p> :
      <ul className="divide-y max-h-96 overflow-y-auto">{reminders.map(student => <li key={student.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1"><p className="font-medium break-words">{student.full_name}</p><p className="text-xs text-muted-foreground">תוקף: {student.health_approval_expiry?.split("-").reverse().join(".")}</p><MedicalExpiryBadge approved={student.health_approval === true} expiresOn={student.health_approval_expiry} /></div>
        <Button asChild variant="outline" size="sm"><Link to="/students/$studentId" params={{ studentId: student.id }}>פתיחת כרטיס</Link></Button>
      </li>)}</ul>}
  </section>;
}