import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UsersRound, CalendarCheck, Wallet, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "לוח בקרה — מאמן" }] }),
});

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [students, groups, lessons, payments] = await Promise.all([
        supabase.from("students").select("*", { count: "exact", head: true }).eq("active", true),
        supabase.from("groups").select("*", { count: "exact", head: true }),
        supabase.from("lessons").select("*", { count: "exact", head: true }).gte("lesson_date", new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)),
        supabase.from("payments").select("amount").gte("payment_date", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)),
      ]);
      const monthTotal = (payments.data ?? []).reduce((s, p) => s + Number(p.amount || 0), 0);
      return {
        studentsCount: students.count ?? 0,
        groupsCount: groups.count ?? 0,
        lessonsCount: lessons.count ?? 0,
        monthTotal,
      };
    },
  });

  const { data: upcoming } = useQuery({
    queryKey: ["upcoming-lessons"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("lessons")
        .select("id, lesson_date, start_time, notes, groups(name, color)")
        .gte("lesson_date", today)
        .order("lesson_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(5);
      return data ?? [];
    },
  });

  const cards = [
    { label: "חניכים פעילים", value: stats?.studentsCount ?? 0, icon: Users, color: "bg-blue-500/10 text-blue-600" },
    { label: "קבוצות", value: stats?.groupsCount ?? 0, icon: UsersRound, color: "bg-emerald-500/10 text-emerald-600" },
    { label: "שיעורים (30 יום)", value: stats?.lessonsCount ?? 0, icon: CalendarCheck, color: "bg-amber-500/10 text-amber-600" },
    { label: "הכנסות החודש", value: `₪${(stats?.monthTotal ?? 0).toLocaleString()}`, icon: Wallet, color: "bg-violet-500/10 text-violet-600" },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">לוח בקרה</h1>
        <p className="text-sm text-muted-foreground mt-1">סקירה כללית של הפעילות שלך</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="border-border/60">
            <CardContent className="p-4 md:p-5">
              <div className={`h-10 w-10 rounded-lg grid place-items-center mb-3 ${c.color}`}>
                <c.icon className="h-5 w-5" />
              </div>
              <div className="text-2xl font-bold">{c.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{c.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" /> שיעורים קרובים
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming && upcoming.length > 0 ? (
            <div className="space-y-2">
              {upcoming.map((l: any) => (
                <div key={l.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/40">
                  <div className="flex items-center gap-3">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.groups?.color || "#3B82F6" }} />
                    <div>
                      <div className="font-medium text-sm">{l.groups?.name ?? "קבוצה"}</div>
                      {l.notes && <div className="text-xs text-muted-foreground">{l.notes}</div>}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground tabular-nums">
                    {new Date(l.lesson_date).toLocaleDateString("he-IL")} · {l.start_time?.slice(0, 5)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">אין שיעורים מתוכננים</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}