import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { medicalApprovalStatus } from "@/lib/medical-approval-status";
import { FileCheck2 } from "lucide-react";

const labels = { valid: "בתוקף", expired: "פג תוקף", unapproved: "לא מאושר", unknown: "ללא תאריך תוקף" };
const date = (value: string) => new Date(value).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" });

export function MedicalApprovalHistory({ studentId }: { studentId: string }) {
  const { data: records = [], isPending, isError, refetch } = useQuery({
    queryKey: ["medical-approval-history", studentId],
    queryFn: async () => {
      const { data, error } = await supabase.from("medical_approval_history").select("*").eq("student_id", studentId).order("recorded_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  return <section className="space-y-4 border-t pt-6" aria-labelledby="medical-history-title">
    <h2 id="medical-history-title" className="flex items-center gap-2 text-lg font-semibold"><FileCheck2 className="h-5 w-5 text-primary" />היסטוריית אישורים רפואיים</h2>
    {isPending ? <p className="text-sm text-muted-foreground">טוען אישורים...</p> : isError ? <div className="flex items-center gap-3"><p className="text-sm text-destructive">לא ניתן לטעון את ההיסטוריה</p><Button variant="outline" size="sm" onClick={() => refetch()}>נסה שוב</Button></div> : records.length === 0 ? <p className="text-sm text-muted-foreground">אין אישורים רפואיים בהיסטוריה</p> :
      <div className="overflow-x-auto"><table className="w-full text-right text-sm">
        <thead className="border-b text-muted-foreground"><tr><th className="p-3 font-medium whitespace-nowrap">תאריך רישום</th><th className="p-3 font-medium whitespace-nowrap">תאריך העלאה</th><th className="p-3 font-medium whitespace-nowrap">תאריך תוקף</th><th className="p-3 font-medium whitespace-nowrap">סטטוס אישור</th></tr></thead>
        <tbody>{records.map(record => {
          const status = medicalApprovalStatus(record.approved, record.expires_on, today);
          return <tr key={record.id} className="border-b last:border-0">
            <td className="p-3 whitespace-nowrap">{date(record.recorded_at)}{record.source === "existing" && <span className="block text-xs text-muted-foreground">רישום קודם</span>}</td>
            <td className="p-3 whitespace-nowrap">{record.uploaded_at ? date(record.uploaded_at) : "לא הועלה קובץ"}</td>
            <td className="p-3 whitespace-nowrap">{record.expires_on ? date(record.expires_on) : "לא צוין"}</td>
            <td className="p-3"><Badge variant={status === "expired" || status === "unapproved" ? "destructive" : "outline"}>{labels[status]}</Badge><span className="block mt-1 text-xs text-muted-foreground">{record.approved ? "אושר על ידי המנהל" : "לא אושר על ידי המנהל"}</span></td>
          </tr>;
        })}</tbody>
      </table></div>}
  </section>;
}