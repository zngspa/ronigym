import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Trash2, Save, Wallet, CalendarCheck, UsersRound, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/students/$studentId")({
  component: StudentDetail,
  head: () => ({ meta: [{ title: "כרטיס חניך — מאמן" }] }),
});

function StudentDetail() {
  const { studentId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState<any>(null);

  const { data: student } = useQuery({
    queryKey: ["student", studentId],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").eq("id", studentId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => { if (student) setForm(student); }, [student]);

  const { data: memberships = [] } = useQuery({
    queryKey: ["student-groups", studentId],
    queryFn: async () => {
      const { data } = await supabase.from("group_members").select("group_id, groups(id, name, color)").eq("student_id", studentId);
      return data ?? [];
    },
  });

  const { data: allGroups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => (await supabase.from("groups").select("id, name, color")).data ?? [],
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["student-attendance", studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("id, status, notes, lessons(lesson_date, start_time, groups(name, color))")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["student-payments", studentId],
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("*").eq("student_id", studentId).order("payment_date", { ascending: false });
      return data ?? [];
    },
  });

  const save = async () => {
    if (!form) return;
    const { id, coach_id, created_at, updated_at, ...rest } = form;
    const { error } = await supabase.from("students").update(rest).eq("id", studentId);
    if (error) return toast.error(error.message);
    toast.success("הכרטיס נשמר");
    qc.invalidateQueries({ queryKey: ["student", studentId] });
    qc.invalidateQueries({ queryKey: ["students"] });
  };

  const remove = async () => {
    if (!confirm("למחוק את החניך? פעולה זו תמחק גם את נוכחויותיו ותשלומיו.")) return;
    const { error } = await supabase.from("students").delete().eq("id", studentId);
    if (error) return toast.error(error.message);
    toast.success("נמחק");
    qc.invalidateQueries({ queryKey: ["students"] });
    navigate({ to: "/students" });
  };

  const toggleGroup = async (groupId: string, joined: boolean) => {
    const { data: userRes } = await supabase.auth.getUser();
    const coach_id = userRes.user?.id;
    if (!coach_id) return;
    if (joined) {
      await supabase.from("group_members").delete().eq("group_id", groupId).eq("student_id", studentId);
    } else {
      await supabase.from("group_members").insert({ group_id: groupId, student_id: studentId, coach_id });
    }
    qc.invalidateQueries({ queryKey: ["student-groups", studentId] });
  };

  const [payOpen, setPayOpen] = useState(false);
  const [pay, setPay] = useState({ amount: "", method: "מזומן", notes: "", payment_date: new Date().toISOString().slice(0, 10) });

  const addPayment = async () => {
    const { data: userRes } = await supabase.auth.getUser();
    const coach_id = userRes.user?.id;
    if (!coach_id) return;
    if (!pay.amount) return toast.error("נדרש סכום");
    const { error } = await supabase.from("payments").insert({
      coach_id, student_id: studentId,
      amount: Number(pay.amount), method: pay.method, notes: pay.notes || null,
      payment_date: pay.payment_date,
    });
    if (error) return toast.error(error.message);
    toast.success("תשלום נרשם");
    setPayOpen(false);
    setPay({ amount: "", method: "מזומן", notes: "", payment_date: new Date().toISOString().slice(0, 10) });
    qc.invalidateQueries({ queryKey: ["student-payments", studentId] });
  };

  if (!form) return <div className="p-8 text-center text-muted-foreground">טוען...</div>;

  const memberIds = new Set(memberships.map((m: any) => m.group_id));

  const statusLabels: Record<string, { label: string; cls: string }> = {
    present: { label: "נוכח", cls: "bg-emerald-500/15 text-emerald-700" },
    absent: { label: "נעדר", cls: "bg-red-500/15 text-red-700" },
    late: { label: "איחור", cls: "bg-amber-500/15 text-amber-700" },
    excused: { label: "מוצדק", cls: "bg-blue-500/15 text-blue-700" },
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/students"><Button size="icon" variant="ghost"><ArrowRight className="h-4 w-4" /></Button></Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">{form.full_name}</h1>
            <p className="text-sm text-muted-foreground">כרטיס אישי וגליון פעילות</p>
          </div>
        </div>
        <Button variant="ghost" onClick={remove}><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </div>

      <Tabs defaultValue="details">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="details">פרטים</TabsTrigger>
          <TabsTrigger value="groups">קבוצות</TabsTrigger>
          <TabsTrigger value="attendance">נוכחות</TabsTrigger>
          <TabsTrigger value="payments">תשלומים</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4 pt-4">
          <Card><CardContent className="p-5 grid gap-4 md:grid-cols-2">
            <div><Label>שם מלא</Label><Input value={form.full_name || ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div><Label>תעודת זהות</Label><Input value={form.id_number || ""} onChange={(e) => setForm({ ...form, id_number: e.target.value })} /></div>
            <div><Label>טלפון</Label><Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>אימייל</Label><Input value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>כתובת</Label><Input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>תאריך לידה</Label><Input type="date" value={form.birth_date || ""} onChange={(e) => setForm({ ...form, birth_date: e.target.value || null })} /></div>
            <div><Label>סוג דם</Label><Input value={form.blood_type || ""} onChange={(e) => setForm({ ...form, blood_type: e.target.value })} placeholder="A+, O-" /></div>
            <div><Label>איש קשר לחירום</Label><Input value={form.emergency_contact_name || ""} onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })} /></div>
            <div><Label>טלפון חירום</Label><Input value={form.emergency_contact_phone || ""} onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })} /></div>
            <div><Label>תשלום חודשי (₪)</Label><Input type="number" value={form.monthly_fee || 0} onChange={(e) => setForm({ ...form, monthly_fee: Number(e.target.value) })} /></div>
            <div><Label>תוקף אישור בריאות</Label><Input type="date" value={form.health_approval_expiry || ""} onChange={(e) => setForm({ ...form, health_approval_expiry: e.target.value || null })} /></div>
          </CardContent></Card>

          <Card><CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox id="ha" checked={!!form.health_approval} onCheckedChange={(v) => setForm({ ...form, health_approval: !!v })} />
              <Label htmlFor="ha" className="cursor-pointer">קיים אישור רפואי בתוקף</Label>
            </div>
            <div><Label>הערות בריאות</Label><Textarea value={form.health_notes || ""} onChange={(e) => setForm({ ...form, health_notes: e.target.value })} rows={3} /></div>
            <div><Label>הערות כלליות</Label><Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
            <div className="flex items-center gap-2">
              <Checkbox id="active" checked={!!form.active} onCheckedChange={(v) => setForm({ ...form, active: !!v })} />
              <Label htmlFor="active" className="cursor-pointer">חניך פעיל</Label>
            </div>
          </CardContent></Card>

          <div className="flex justify-end">
            <Button onClick={save}><Save className="h-4 w-4 ml-1" /> שמור שינויים</Button>
          </div>
        </TabsContent>

        <TabsContent value="groups" className="pt-4">
          <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><UsersRound className="h-4 w-4" /> קבוצות</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {allGroups.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">אין קבוצות. צור קבוצה תחילה.</p> :
                allGroups.map((g: any) => {
                  const joined = memberIds.has(g.id);
                  return (
                    <div key={g.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: g.color }} />
                        <span className="font-medium">{g.name}</span>
                      </div>
                      <Button size="sm" variant={joined ? "secondary" : "default"} onClick={() => toggleGroup(g.id, joined)}>
                        {joined ? "הסר" : "הוסף"}
                      </Button>
                    </div>
                  );
                })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="pt-4">
          <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><CalendarCheck className="h-4 w-4" /> היסטוריית נוכחות</CardTitle></CardHeader>
            <CardContent>
              {attendance.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">אין רישומי נוכחות</p> :
                <div className="space-y-2">
                  {attendance.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/40">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: a.lessons?.groups?.color || "#3B82F6" }} />
                        <div>
                          <div className="text-sm font-medium">{a.lessons?.groups?.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {a.lessons?.lesson_date && new Date(a.lessons.lesson_date).toLocaleDateString("he-IL")} · {a.lessons?.start_time?.slice(0, 5)}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className={statusLabels[a.status]?.cls}>{statusLabels[a.status]?.label}</Badge>
                    </div>
                  ))}
                </div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="pt-4 space-y-3">
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4" /> תשלומים</CardTitle>
            <Button size="sm" onClick={() => setPayOpen(true)}><Plus className="h-4 w-4 ml-1" /> תשלום</Button>
          </CardHeader>
            <CardContent>
              {payments.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">אין תשלומים</p> :
                <div className="space-y-2">
                  {payments.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/40">
                      <div>
                        <div className="font-semibold">₪{Number(p.amount).toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">{new Date(p.payment_date).toLocaleDateString("he-IL")} · {p.method}</div>
                        {p.notes && <div className="text-xs text-muted-foreground mt-0.5">{p.notes}</div>}
                      </div>
                      <Button size="icon" variant="ghost" onClick={async () => {
                        if (!confirm("למחוק תשלום?")) return;
                        await supabase.from("payments").delete().eq("id", p.id);
                        qc.invalidateQueries({ queryKey: ["student-payments", studentId] });
                      }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  ))}
                </div>}
            </CardContent>
          </Card>

          {payOpen && (
            <Card><CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>סכום</Label><Input type="number" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></div>
                <div><Label>תאריך</Label><Input type="date" value={pay.payment_date} onChange={(e) => setPay({ ...pay, payment_date: e.target.value })} /></div>
                <div><Label>אמצעי</Label><Input value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })} placeholder="מזומן / ביט / העברה" /></div>
                <div><Label>הערה</Label><Input value={pay.notes} onChange={(e) => setPay({ ...pay, notes: e.target.value })} /></div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPayOpen(false)}>ביטול</Button>
                <Button onClick={addPayment}>שמור</Button>
              </div>
            </CardContent></Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}