import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Phone, ChevronLeft, Save, UsersRound } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/students")({
  component: StudentsPage,
  head: () => ({
    meta: [
      { title: "ניהול חניכים — RoniGym" },
      { name: "description", content: "מסך ניהול חניכים, פרטים אישיים, בריאות ותשלומים למאמן כושר." },
      { property: "og:title", content: "ניהול חניכים — RoniGym" },
      { property: "og:description", content: "עריכת פרטי חניכים ומעקב אחר נתונים אישיים ובריאותיים." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const emptyStudentForm = {
  full_name: "",
  phone: "",
  email: "",
  monthly_fee: "",
};

function StudentsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyStudentForm);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  const [newGroupIds, setNewGroupIds] = useState<string[]>([]);
  const [groupsFor, setGroupsFor] = useState<any>(null);

  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const { data, error } = await supabase.from("groups").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: memberships = [] } = useQuery({
    queryKey: ["group-members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("group_members").select("group_id, student_id");
      if (error) throw error;
      return data;
    },
  });

  const groupsOfStudent = (studentId: string) =>
    memberships
      .filter((m: any) => m.student_id === studentId)
      .map((m: any) => groups.find((g: any) => g.id === m.group_id))
      .filter(Boolean);

  const toggleMembership = async (studentId: string, groupId: string, isMember: boolean) => {
    const { data: userRes } = await supabase.auth.getUser();
    const coach_id = userRes.user?.id;
    if (!coach_id) return;
    const { error } = isMember
      ? await supabase
          .from("group_members")
          .delete()
          .eq("student_id", studentId)
          .eq("group_id", groupId)
      : await supabase
          .from("group_members")
          .insert({ coach_id, student_id: studentId, group_id: groupId });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["group-members"] });
    qc.invalidateQueries({ queryKey: ["groups"] });
  };

  const filtered = useMemo(() => {
    if (!q.trim()) return students;
    const s = q.trim().toLowerCase();
    return students.filter((st: any) =>
      st.full_name?.toLowerCase().includes(s) || st.phone?.includes(s) || st.id_number?.includes(s),
    );
  }, [students, q]);

  const create = async () => {
    if (!form.full_name.trim()) return toast.error("נדרש שם");
    const { data: userRes } = await supabase.auth.getUser();
    const coach_id = userRes.user?.id;
    if (!coach_id) return;
    const { data: inserted, error } = await supabase.from("students").insert({
      coach_id,
      full_name: form.full_name,
      phone: form.phone || null,
      email: form.email || null,
      monthly_fee: form.monthly_fee ? Number(form.monthly_fee) : 0,
    }).select("id").single();
    if (error) return toast.error(error.message);
    if (inserted && newGroupIds.length > 0) {
      const { error: memErr } = await supabase.from("group_members").insert(
        newGroupIds.map((gid) => ({ coach_id, student_id: inserted.id, group_id: gid })),
      );
      if (memErr) toast.error(memErr.message);
    }
    toast.success("חניך נוסף");
    setOpen(false);
    setForm(emptyStudentForm);
    setNewGroupIds([]);
    qc.invalidateQueries({ queryKey: ["students"] });
    qc.invalidateQueries({ queryKey: ["group-members"] });
    qc.invalidateQueries({ queryKey: ["groups"] });
  };

  const openEdit = (student: any) => {
    setEditForm({
      id: student.id,
      full_name: student.full_name ?? "",
      id_number: student.id_number ?? "",
      phone: student.phone ?? "",
      email: student.email ?? "",
      address: student.address ?? "",
      birth_date: student.birth_date ?? "",
      blood_type: student.blood_type ?? "",
      emergency_contact_name: student.emergency_contact_name ?? "",
      emergency_contact_phone: student.emergency_contact_phone ?? "",
      monthly_fee: student.monthly_fee ?? 0,
      health_approval_expiry: student.health_approval_expiry ?? "",
      health_approval: !!student.health_approval,
      health_notes: student.health_notes ?? "",
      notes: student.notes ?? "",
      active: student.active !== false,
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editForm?.id) return;
    if (!String(editForm.full_name ?? "").trim()) return toast.error("נדרש שם");

    const { id, ...payload } = editForm;
    const { error } = await supabase
      .from("students")
      .update({
        ...payload,
        full_name: payload.full_name.trim(),
        id_number: payload.id_number || null,
        phone: payload.phone || null,
        email: payload.email || null,
        address: payload.address || null,
        birth_date: payload.birth_date || null,
        blood_type: payload.blood_type || null,
        emergency_contact_name: payload.emergency_contact_name || null,
        emergency_contact_phone: payload.emergency_contact_phone || null,
        monthly_fee: Number(payload.monthly_fee) || 0,
        health_approval_expiry: payload.health_approval_expiry || null,
        health_notes: payload.health_notes || null,
        notes: payload.notes || null,
      })
      .eq("id", id);

    if (error) return toast.error(error.message);
    toast.success("פרטי החניך נשמרו");
    setEditOpen(false);
    setEditForm(null);
    qc.invalidateQueries({ queryKey: ["students"] });
    qc.invalidateQueries({ queryKey: ["student", id] });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">חניכים</h1>
          <p className="text-sm text-muted-foreground mt-1">ניהול רשימת החניכים והכרטיס האישי</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 ml-1" /> חניך חדש</Button>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש לפי שם, טלפון או ת.ז" className="pr-10" />
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          {students.length === 0 ? "אין חניכים עדיין. הוסף חניך ראשון." : "לא נמצאו תוצאות"}
        </CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map((s: any) => (
            <Card key={s.id} className="hover:shadow-md hover:border-primary/40 transition-all">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-11 w-11 rounded-full bg-primary/10 text-primary grid place-items-center font-semibold flex-shrink-0">
                    {s.full_name?.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <Button variant="link" className="h-auto p-0 font-medium text-right text-foreground" onClick={() => openEdit(s)}>
                      <span className="truncate">{s.full_name}</span>
                    </Button>
                    {s.phone && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" /> {s.phone}
                      </div>
                    )}
                    <div className="flex items-center gap-1 flex-wrap mt-1">
                      {groupsOfStudent(s.id).map((g: any) => (
                        <span
                          key={g.id}
                          className="text-[10px] px-1.5 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: g.color || "#3B82F6" }}
                        >
                          {g.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="שיוך לקבוצות"
                    onClick={() => setGroupsFor(s)}
                  >
                    <UsersRound className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" asChild aria-label="פתח כרטיס פעילות">
                    <Link to="/students/$studentId" params={{ studentId: s.id }}>
                      <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>חניך חדש</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>שם מלא *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div><Label>טלפון</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>אימייל</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>תשלום חודשי (₪)</Label><Input type="number" value={form.monthly_fee} onChange={(e) => setForm({ ...form, monthly_fee: e.target.value })} /></div>
            <div>
              <Label>שיוך לקבוצות</Label>
              {groups.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-1">אין קבוצות עדיין — ניתן ליצור בדף "קבוצות".</p>
              ) : (
                <div className="flex items-center gap-2 flex-wrap mt-1.5">
                  {groups.map((g: any) => {
                    const on = newGroupIds.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() =>
                          setNewGroupIds((prev) =>
                            on ? prev.filter((id) => id !== g.id) : [...prev, g.id],
                          )
                        }
                        className={`px-3 py-1 rounded-full text-xs border ${on ? "text-white border-transparent" : "bg-muted/50 border-transparent"}`}
                        style={on ? { backgroundColor: g.color || "#3B82F6" } : undefined}
                      >
                        {g.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">שאר הפרטים (ת.ז, סוג דם, בריאות וכו') ניתן להזין בכרטיס האישי לאחר היצירה.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
            <Button onClick={create}>הוסף</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>עריכת פרטי חניך</DialogTitle></DialogHeader>
          {editForm && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>שם מלא *</Label><Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} /></div>
                <div><Label>תעודת זהות</Label><Input value={editForm.id_number} onChange={(e) => setEditForm({ ...editForm, id_number: e.target.value })} /></div>
                <div><Label>טלפון</Label><Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></div>
                <div><Label>אימייל</Label><Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></div>
                <div className="md:col-span-2"><Label>כתובת</Label><Input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} /></div>
                <div><Label>תאריך לידה</Label><Input type="date" value={editForm.birth_date} onChange={(e) => setEditForm({ ...editForm, birth_date: e.target.value })} /></div>
                <div><Label>סוג דם</Label><Input value={editForm.blood_type} onChange={(e) => setEditForm({ ...editForm, blood_type: e.target.value })} placeholder="A+, O-" /></div>
                <div><Label>איש קשר לחירום</Label><Input value={editForm.emergency_contact_name} onChange={(e) => setEditForm({ ...editForm, emergency_contact_name: e.target.value })} /></div>
                <div><Label>טלפון חירום</Label><Input value={editForm.emergency_contact_phone} onChange={(e) => setEditForm({ ...editForm, emergency_contact_phone: e.target.value })} /></div>
                <div><Label>תשלום חודשי (₪)</Label><Input type="number" value={editForm.monthly_fee} onChange={(e) => setEditForm({ ...editForm, monthly_fee: e.target.value })} /></div>
                <div><Label>תוקף אישור בריאות</Label><Input type="date" value={editForm.health_approval_expiry} onChange={(e) => setEditForm({ ...editForm, health_approval_expiry: e.target.value })} /></div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox id="edit-health-approval" checked={!!editForm.health_approval} onCheckedChange={(v) => setEditForm({ ...editForm, health_approval: !!v })} />
                  <Label htmlFor="edit-health-approval" className="cursor-pointer">קיים אישור רפואי בתוקף</Label>
                </div>
                <div><Label>הערות בריאות</Label><Textarea value={editForm.health_notes} onChange={(e) => setEditForm({ ...editForm, health_notes: e.target.value })} rows={3} /></div>
                <div><Label>הערות כלליות</Label><Textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={3} /></div>
                <div className="flex items-center gap-2">
                  <Checkbox id="edit-active" checked={!!editForm.active} onCheckedChange={(v) => setEditForm({ ...editForm, active: !!v })} />
                  <Label htmlFor="edit-active" className="cursor-pointer">חניך פעיל</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>ביטול</Button>
            <Button onClick={saveEdit}><Save className="h-4 w-4 ml-1" /> שמור שינויים</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!groupsFor} onOpenChange={(o) => !o && setGroupsFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>שיוך {groupsFor?.full_name} לקבוצות</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">אין קבוצות עדיין.</p>
            ) : (
              groups.map((g: any) => {
                const isMember = memberships.some(
                  (m: any) => m.student_id === groupsFor?.id && m.group_id === g.id,
                );
                return (
                  <div key={g.id} className="flex items-center justify-between gap-3 p-2.5 border rounded-lg">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: g.color || "#3B82F6" }} />
                      <span className="text-sm truncate">{g.name}</span>
                    </div>
                    <Button
                      size="sm"
                      variant={isMember ? "outline" : "default"}
                      onClick={() => toggleMembership(groupsFor.id, g.id, isMember)}
                    >
                      {isMember ? "הסר" : "צרף"}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupsFor(null)}>סגור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}