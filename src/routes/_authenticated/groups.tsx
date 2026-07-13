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
import { Plus, Users, Pencil, Trash2 } from "lucide-react";
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
    </div>
  );
}