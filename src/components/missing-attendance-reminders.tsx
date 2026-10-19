import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ClipboardCheck, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useIsraelToday } from "@/hooks/use-israel-today";

export function MissingAttendanceReminders() {
  const today = useIsraelToday();
  const { data: lessons = [], isPending, isError, refetch } = useQuery({
    enabled: !!today,
    queryKey: ["lessons-missing-attendance", today],
    queryFn: async () => {
      const from = new Date(`${today}T00:00:00`);
      from.setDate(from.getDate() - 30);
      const { data, error } = await supabase
        .from("lessons")
        .select("id, lesson_date, start_time, groups(id, name, color), attendance(id)")
        .lte("lesson_date", today!)
        .gte("lesson_date", from.toISOString().slice(0, 10))
        .order("lesson_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
  });

  const missing = lessons.filter((l: any) => (l.attendance?.length ?? 0) === 0);

  return (
    <section aria-label="תזכורות נוכחות חסרה" className="space-y-3 border-t pt-5">
      <h2 className="flex items-center gap-2 font-semibold text-lg">
        <ClipboardCheck className="h-5 w-5 text-primary" />
        נוכחות שלא נרשמה
        {missing.length > 0 && <span className="text-sm text-muted-foreground">({missing.length})</span>}
      </h2>
      {isPending || !today ? (
        <p className="text-sm text-muted-foreground">בודק רישומי נוכחות...</p>
      ) : isError ? (
        <div className="flex items-center gap-2">
          <p className="text-sm text-destructive">לא ניתן לטעון את התזכורות</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>נסה שוב</Button>
        </div>
      ) : missing.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4" />כל השיעורים ב־30 הימים האחרונים תועדו
        </p>
      ) : (
        <ul className="divide-y max-h-96 overflow-y-auto">
          {missing.map((l: any) => (
            <li key={l.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="h-8 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: l.groups?.color }} />
                <div className="min-w-0">
                  <p className="font-medium break-words">{l.groups?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.lesson_date.split("-").reverse().join(".")}
                    {l.start_time ? ` · ${l.start_time.slice(0, 5)}` : ""}
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/lessons">רישום נוכחות</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
