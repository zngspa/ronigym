import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Users, Pencil, Trash2, UserPlus, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/groups")({
  component: GroupsPage,
  head: () => ({ meta: [{ title: "קבוצות — מאמן" }] }),
});

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6"];

function GroupsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", description: "", color: COLORS[0], schedule_notes: "" });
  const [membersGroup, setMembersGroup] = useState<any>(null);
  const [memberSearch, setMemberSearch] = useState("");

  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*, group_members(student_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: allStudents = [] } = useQuery({
    queryKey: ["students"],
    queryFn: async () => (await supabase.from("students").select("id, full_name, phone").order("full_name")).data ?? [],
  });

  const { data: groupMembers = [] } = useQuery({
    enabled: !!membersGroup,
    queryKey: ["group-members", membersGroup?.id],
    queryFn: async () => {
      const { data } = await supabase.from("group_members").select("student_id").eq("group_id", membersGroup.id);
      return data ?? [];
    },
  });

  const memberIds = new Set(groupMembers.map((m: any) => m.student_id));

  const toggleMember = async (studentId: string, joined: boolean) => {
    if (!membersGroup) return;
    const { data: userRes } = await supabase.auth.getUser();
    const coach_id = userRes.user?.id;
    if (!coach_id) return;
    if (joined) {
      await supabase.from("group_members").delete().eq("group_id", membersGroup.id).eq("student_id", studentId);
    } else {
      await supabase.from("group_members").insert({ group_id: membersGroup.id, student_id: studentId, coach_id });
    }
    qc.invalidateQueries({ queryKey: ["group-members", membersGroup.id] });
    qc.invalidateQueries({ queryKey: ["groups"] });
  };

  const filteredStudents = memberSearch.trim()
    ? allStudents.filter((s: any) => s.full_name?.toLowerCase().includes(memberSearch.trim().toLowerCase()) || s.phone?.includes(memberSearch.trim()))
    : allStudents;

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", description: "", color: COLORS[0], schedule_notes: "" });
    setOpen(true);
  };
  const openEdit = (g: any) => {
    setEditing(g);
    setForm({ name: g.name, description: g.description ?? "", color: g.color ?? COLORS[0], schedule_notes: g.schedule_notes ?? "" });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("נדרש שם קבוצה");
    const { data: userRes } = await supabase.auth.getUser();
    const coach_id = userRes.user?.id;
    if (!coach_id) return;
    if (editing) {
      const { error } = await supabase.from("groups").update(form).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("הקבוצה עודכנה");
    } else {
      const { error } = await supabase.from("groups").insert({ ...form, coach_id });
      if (error) return toast.error(error.message);
      toast.success("הקבוצה נוצרה");
    }
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["groups"] });
  };

  const remove = async (id: string) => {
    if (!confirm("למחוק את הקבוצה?")) return;
    const { error } = await supabase.from("groups").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("נמחק");
    qc.invalidateQueries({ queryKey: ["groups"] });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">קבוצות</h1>
          <p className="text-sm text-muted-foreground mt-1">ניהול קבוצות האימון שלך</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 ml-1" /> קבוצה חדשה</Button>
      </div>

      {groups.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">אין קבוצות עדיין. צור קבוצה ראשונה.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((g: any) => (
            <Card key={g.id} className="overflow-hidden">
              <div className="h-1.5" style={{ backgroundColor: g.color }} />
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-base">{g.name}</div>
                    {g.description && <div className="text-sm text-muted-foreground mt-1">{g.description}</div>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(g)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(g.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
                {g.schedule_notes && <div className="text-xs bg-muted/60 rounded-md p-2">{g.schedule_notes}</div>}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                  <Users className="h-3.5 w-3.5" /> {g.group_members?.length ?? 0} חניכים
                </div>
                <Button size="sm" variant="outline" className="w-full" onClick={() => { setMembersGroup(g); setMemberSearch(""); }}>
                  <UserPlus className="h-4 w-4 ml-1" /> ניהול חניכים
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "עריכת קבוצה" : "קבוצה חדשה"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>שם קבוצה</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>תיאור</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label>לוח זמנים / הערות</Label>
              <Textarea value={form.schedule_notes} onChange={(e) => setForm({ ...form, schedule_notes: e.target.value })} placeholder="ימי א' ו-ד' 18:00" />
            </div>
            <div>
              <Label>צבע</Label>
              <div className="flex gap-2 mt-2">
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                    className={`h-8 w-8 rounded-full border-2 transition ${form.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
            <Button onClick={save}>שמור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!membersGroup} onOpenChange={(v) => !v && setMembersGroup(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>חניכים בקבוצה {membersGroup?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} placeholder="חיפוש חניך" className="pr-10" />
            </div>
            <div className="max-h-[50vh] overflow-y-auto space-y-1.5">
              {allStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">אין חניכים. הוסף חניכים תחילה.</p>
              ) : filteredStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">לא נמצאו תוצאות</p>
              ) : filteredStudents.map((s: any) => {
                const joined = memberIds.has(s.id);
                return (
                  <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg border">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-primary/10 text-primary grid place-items-center font-semibold text-sm flex-shrink-0">
                        {s.full_name?.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{s.full_name}</div>
                        {s.phone && <div className="text-xs text-muted-foreground">{s.phone}</div>}
                      </div>
                    </div>
                    <Button size="sm" variant={joined ? "secondary" : "default"} onClick={() => toggleMember(s.id, joined)}>
                      {joined ? "הסר" : "הוסף"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMembersGroup(null)}>סגור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}