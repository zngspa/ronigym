import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, ClipboardCheck, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/lessons")({
  component: LessonsPage,
  head: () => ({ meta: [{ title: "שיעורים ונוכחות — מאמן" }] }),
});

function LessonsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    group_id: "",
    lesson_date: new Date().toISOString().slice(0, 10),
    start_time: "18:00",
    end_time: "19:00",
    location: "",
    notes: "",
  });
  const [attendanceLesson, setAttendanceLesson] = useState<any>(null);

  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => (await supabase.from("groups").select("id, name, color").order("name")).data ?? [],
  });

  const { data: lessons = [] } = useQuery({
    queryKey: ["lessons"],
    queryFn: async () => {
      const { data } = await supabase
        .from("lessons")
        .select("*, groups(id, name, color), attendance(id, status)")
        .order("lesson_date", { ascending: false })
        .order("start_time", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const create = async () => {
    if (!form.group_id) return toast.error("בחר קבוצה");
    const { data: userRes } = await supabase.auth.getUser();
    const coach_id = userRes.user?.id;
    if (!coach_id) return;
    const { error } = await supabase.from("lessons").insert({ ...form, coach_id });
    if (error) return toast.error(error.message);
    toast.success("שיעור נוצר");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["lessons"] });
  };

  const removeLesson = async (id: string) => {
    if (!confirm("למחוק שיעור?")) return;
    await supabase.from("lessons").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["lessons"] });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">שיעורים ונוכחות</h1>
          <p className="text-sm text-muted-foreground mt-1">רישום שיעורים ונוכחות חניכים</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 ml-1" /> שיעור חדש</Button>
      </div>

      {lessons.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">אין שיעורים עדיין</CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {lessons.map((l: any) => {
            const present = l.attendance?.filter((a: any) => a.status === "present").length ?? 0;
            const total = l.attendance?.length ?? 0;
            return (
              <Card key={l.id}>
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: l.groups?.color }} />
                    <div className="min-w-0">
                      <div className="font-medium">{l.groups?.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span>{new Date(l.lesson_date).toLocaleDateString("he-IL")}</span>
                        <Clock className="h-3 w-3" />
                        <span>{l.start_time?.slice(0, 5)}{l.end_time ? `–${l.end_time.slice(0, 5)}` : ""}</span>
                        {total > 0 && <span className="text-emerald-600">· נוכחים {present}/{total}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => setAttendanceLesson(l)}>
                      <ClipboardCheck className="h-4 w-4 ml-1" /> נוכחות
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => removeLesson(l.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>שיעור חדש</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>קבוצה</Label>
              <Select value={form.group_id} onValueChange={(v) => setForm({ ...form, group_id: v })}>
                <SelectTrigger><SelectValue placeholder="בחר קבוצה" /></SelectTrigger>
                <SelectContent>
                  {groups.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>תאריך</Label><Input type="date" value={form.lesson_date} onChange={(e) => setForm({ ...form, lesson_date: e.target.value })} /></div>
              <div><Label>התחלה</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
              <div><Label>סיום</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
            </div>
            <div><Label>מיקום</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div><Label>הערות</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
            <Button onClick={create}>צור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {attendanceLesson && (
        <AttendanceDialog lesson={attendanceLesson} onClose={() => setAttendanceLesson(null)} />
      )}
    </div>
  );
}

function AttendanceDialog({ lesson, onClose }: { lesson: any; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: rows = [], refetch } = useQuery({
    queryKey: ["attendance-editor", lesson.id],
    queryFn: async () => {
      const [members, existing] = await Promise.all([
        supabase.from("group_members").select("students(id, full_name)").eq("group_id", lesson.group_id),
        supabase.from("attendance").select("*").eq("lesson_id", lesson.id),
      ]);
      const map = new Map((existing.data ?? []).map((a: any) => [a.student_id, a]));
      return (members.data ?? []).map((m: any) => ({
        student: m.students,
        status: map.get(m.students.id)?.status ?? "present",
        notes: map.get(m.students.id)?.notes ?? "",
        existingId: map.get(m.students.id)?.id,
      }));
    },
  });

  const [local, setLocal] = useState<any[] | null>(null);
  const items = local ?? rows;

  const setStatus = (studentId: string, status: string) => {
    setLocal(items.map((r: any) => r.student.id === studentId ? { ...r, status } : r));
  };
  const setNote = (studentId: string, notes: string) => {
    setLocal(items.map((r: any) => r.student.id === studentId ? { ...r, notes } : r));
  };

  const save = async () => {
    const { data: userRes } = await supabase.auth.getUser();
    const coach_id = userRes.user?.id;
    if (!coach_id) return;
    const upserts = items.map((r: any) => ({
      lesson_id: lesson.id,
      student_id: r.student.id,
      coach_id,
      status: r.status,
      notes: r.notes || null,
    }));
    const { error } = await supabase.from("attendance").upsert(upserts, { onConflict: "lesson_id,student_id" });
    if (error) return toast.error(error.message);
    toast.success("נוכחות נשמרה");
    qc.invalidateQueries({ queryKey: ["lessons"] });
    onClose();
  };

  const statuses = [
    { v: "present", label: "נוכח", cls: "bg-emerald-500 text-white" },
    { v: "absent", label: "נעדר", cls: "bg-red-500 text-white" },
  ];

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>נוכחות · {lesson.groups?.name} · {new Date(lesson.lesson_date).toLocaleDateString("he-IL")}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">אין חניכים בקבוצה. הוסף חניכים מהכרטיס האישי.</p>
          ) : items.map((r: any) => (
            <div key={r.student.id} className="p-3 border rounded-lg space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-sm">{r.student.full_name}</div>
                <div className="flex gap-1">
                  {statuses.map((s) => (
                    <button key={s.v} onClick={() => setStatus(r.student.id, s.v)}
                      className={`px-2.5 py-1 text-xs rounded-md transition ${r.status === s.v ? s.cls : "bg-muted text-muted-foreground"}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <Input placeholder="הערה (אופציונלי)" value={r.notes || ""} onChange={(e) => setNote(r.student.id, e.target.value)} className="h-8 text-sm" />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ביטול</Button>
          <Button onClick={save}>שמור נוכחות</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}