import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Wallet, TrendingUp, MessageCircle, Plus, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/payments")({
  component: PaymentsPage,
  head: () => ({ meta: [{ title: "תשלומים — מאמן" }] }),
});

const monthLabel = (d: Date) => d.toLocaleDateString("he-IL", { month: "long", year: "numeric" });

function PaymentsPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [groupId, setGroupId] = useState<string>("all");
  const [monthKey, setMonthKey] = useState<string>(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  );

  const [y, m] = monthKey.split("-").map(Number);
  const periodStart = new Date(y, m - 1, 1);
  const periodEnd = new Date(y, m, 0, 23, 59, 59);
  const periodStartISO = periodStart.toISOString().slice(0, 10);
  const periodEndISO = periodEnd.toISOString().slice(0, 10);

  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => (await supabase.from("groups").select("id, name, color").order("name")).data ?? [],
  });

  const { data: members = [] } = useQuery({
    queryKey: ["group-members-all"],
    queryFn: async () =>
      (await supabase.from("group_members").select("group_id, student_id")).data ?? [],
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: async () =>
      (await supabase.from("students").select("*").order("full_name")).data ?? [],
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["all-payments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*, students(id, full_name, monthly_fee)")
        .order("payment_date", { ascending: false });
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    let month = 0, year = 0, all = 0;
    payments.forEach((p: any) => {
      const d = new Date(p.payment_date);
      const a = Number(p.amount);
      all += a;
      if (d >= yearStart) year += a;
      if (d >= monthStart) month += a;
    });
    return { month, year, all };
  }, [payments]);

  // Filter students by chosen group
  const groupStudents = useMemo(() => {
    if (groupId === "all") return students as any[];
    const ids = new Set(
      (members as any[]).filter((m) => m.group_id === groupId).map((m) => m.student_id),
    );
    return (students as any[]).filter((s) => ids.has(s.id));
  }, [students, members, groupId]);

  // Per-student summary: last payment ever + total paid in selected period
  const perStudent = useMemo(() => {
    return (groupStudents as any[]).map((s) => {
      const sp = (payments as any[]).filter((p) => p.student_id === s.id);
      const last = sp[0]; // already ordered desc by payment_date
      const inPeriod = sp.filter((p) => {
        const d = p.payment_date;
        return d >= periodStartISO && d <= periodEndISO;
      });
      const paidInPeriod = inPeriod.reduce((sum, p) => sum + Number(p.amount), 0);
      return {
        student: s,
        lastPayment: last,
        paidInPeriod,
        paidCount: inPeriod.length,
      };
    });
  }, [groupStudents, payments, periodStartISO, periodEndISO]);

  const periodTotals = useMemo(() => {
    const paid = perStudent.filter((r) => r.paidCount > 0).length;
    const total = perStudent.reduce((s, r) => s + r.paidInPeriod, 0);
    return { paid, unpaid: perStudent.length - paid, total };
  }, [perStudent]);

  const periodLabel = monthLabel(periodStart);
  const nextPeriodLabel = monthLabel(new Date(y, m, 1));

  const sendWhatsApp = (row: any) => {
    const phoneRaw: string = row.student.phone || "";
    const digits = phoneRaw.replace(/\D/g, "");
    if (!digits) return toast.error("אין מספר טלפון לחניך זה");
    // Israeli local -> international
    let intl = digits;
    if (digits.startsWith("0")) intl = "972" + digits.slice(1);
    else if (!digits.startsWith("972")) intl = "972" + digits;

    const fee = row.student.monthly_fee ? `₪${Number(row.student.monthly_fee).toLocaleString()}` : "";
    const lastLine = row.lastPayment
      ? `תשלום אחרון נרשם בתאריך ${new Date(row.lastPayment.payment_date).toLocaleDateString("he-IL")}.`
      : "טרם נרשם תשלום קודם במערכת.";
    const msg =
      `שלום ${row.student.full_name}, 👋\n` +
      `זו תזכורת ידידותית לתשלום עבור חודש ${nextPeriodLabel}${fee ? ` בסך ${fee}` : ""}.\n` +
      `${lastLine}\n` +
      `תודה רבה! 🙏`;
    const url = `https://wa.me/${intl}?text=${encodeURIComponent(msg)}`;
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const [payFor, setPayFor] = useState<any>(null);
  const [pay, setPay] = useState({ amount: "", method: "מזומן", notes: "", payment_date: new Date().toISOString().slice(0, 10) });
  const openPay = (row: any) => {
    setPayFor(row);
    setPay({
      amount: row.student.monthly_fee ? String(row.student.monthly_fee) : "",
      method: "מזומן",
      notes: `תשלום עבור ${periodLabel}`,
      payment_date: new Date().toISOString().slice(0, 10),
    });
  };
  const savePay = async () => {
    if (!payFor) return;
    if (!pay.amount) return toast.error("נדרש סכום");
    const { data: userRes } = await supabase.auth.getUser();
    const coach_id = userRes.user?.id;
    if (!coach_id) return;
    const { error } = await supabase.from("payments").insert({
      coach_id,
      student_id: payFor.student.id,
      amount: Number(pay.amount),
      method: pay.method,
      notes: pay.notes || null,
      payment_date: pay.payment_date,
      period_start: periodStartISO,
      period_end: periodEndISO,
    });
    if (error) return toast.error(error.message);
    toast.success("תשלום נרשם");
    setPayFor(null);
    qc.invalidateQueries({ queryKey: ["all-payments"] });
  };

  const shiftMonth = (delta: number) => {
    const d = new Date(y, m - 1 + delta, 1);
    setMonthKey(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">תשלומים</h1>
        <p className="text-sm text-muted-foreground mt-1">מעקב הכנסות ותשלומי חניכים</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "החודש", value: stats.month, icon: TrendingUp, color: "bg-emerald-500/10 text-emerald-600" },
          { label: "השנה", value: stats.year, icon: Wallet, color: "bg-blue-500/10 text-blue-600" },
          { label: "סה\"כ", value: stats.all, icon: Wallet, color: "bg-violet-500/10 text-violet-600" },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className={`h-10 w-10 rounded-lg grid place-items-center mb-2 ${c.color}`}>
                <c.icon className="h-5 w-5" />
              </div>
              <div className="text-xl md:text-2xl font-bold">₪{c.value.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{c.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">מעקב תשלומים לפי קבוצה</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[180px]">
              <Label className="text-xs">קבוצה</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל החניכים</SelectItem>
                  {(groups as any[]).map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">תקופה</Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => shiftMonth(-1)}>‹</Button>
                <Input
                  type="month"
                  value={monthKey}
                  onChange={(e) => setMonthKey(e.target.value)}
                  className="w-[160px]"
                />
                <Button variant="outline" size="sm" onClick={() => shiftMonth(1)}>›</Button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm mr-auto">
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
                שילמו: {periodTotals.paid}
              </Badge>
              <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/20">
                לא שילמו: {periodTotals.unpaid}
              </Badge>
              <Badge variant="outline">סה"כ בתקופה: ₪{periodTotals.total.toLocaleString()}</Badge>
            </div>
          </div>

          {perStudent.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">אין חניכים בקבוצה זו</p>
          ) : (
            <div className="space-y-2">
              {perStudent.map((row) => {
                const paid = row.paidCount > 0;
                return (
                  <div
                    key={row.student.id}
                    className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border/40"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-10 w-10 rounded-full bg-primary/10 text-primary grid place-items-center font-semibold flex-shrink-0">
                        {row.student.full_name?.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{row.student.full_name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {row.lastPayment
                            ? `תשלום אחרון: ${new Date(row.lastPayment.payment_date).toLocaleDateString("he-IL")} · ₪${Number(row.lastPayment.amount).toLocaleString()}`
                            : "טרם נרשם תשלום"}
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={paid
                        ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                        : "bg-red-500/10 text-red-700 border-red-500/20"}
                    >
                      {paid ? (
                        <><CheckCircle2 className="h-3 w-3 ml-1" /> שילם ₪{row.paidInPeriod.toLocaleString()}</>
                      ) : (
                        <><AlertCircle className="h-3 w-3 ml-1" /> לא שילם עבור {periodLabel}</>
                      )}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/20"
                        onClick={() => sendWhatsApp(row)}
                        disabled={!row.student.phone}
                        title={row.student.phone ? "שלח תזכורת בוואטסאפ" : "לא הוזן טלפון"}
                      >
                        <MessageCircle className="h-4 w-4 ml-1" /> וואטסאפ
                      </Button>
                      <Button size="sm" onClick={() => openPay(row)}>
                        <Plus className="h-4 w-4 ml-1" /> רשום תשלום
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">היסטוריית תשלומים</CardTitle></CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">אין תשלומים. רשום תשלום מכרטיס חניך.</p>
          ) : (
            <div className="space-y-2">
              {payments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/40">
                  <div>
                    <div className="font-medium">{p.students?.full_name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {new Date(p.payment_date).toLocaleDateString("he-IL")} · {p.method || "—"}
                      {p.notes && ` · ${p.notes}`}
                    </div>
                  </div>
                  <div className="font-bold tabular-nums">₪{Number(p.amount).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>רישום תשלום — {payFor?.student.full_name}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>סכום</Label><Input type="number" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></div>
            <div><Label>תאריך</Label><Input type="date" value={pay.payment_date} onChange={(e) => setPay({ ...pay, payment_date: e.target.value })} /></div>
            <div><Label>אמצעי</Label><Input value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })} placeholder="מזומן / ביט / העברה" /></div>
            <div><Label>הערה</Label><Input value={pay.notes} onChange={(e) => setPay({ ...pay, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayFor(null)}>ביטול</Button>
            <Button onClick={savePay}>שמור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}