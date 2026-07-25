import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, ListChecks, ChevronLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/workouts")({
  component: WorkoutsPage,
  head: () => ({ meta: [{ title: "תוכניות אימון — מאמן" }] }),
});

const emptyForm = { name: "", description: "", default_rest_seconds: "15" };

function WorkoutsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: plans = [] } = useQuery({
    queryKey: ["workout-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_plans")
        .select("*, workout_plan_items(id, duration_seconds, rest_after_seconds)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = async () => {
    if (!form.name.trim()) return toast.error("נדרש שם תוכנית");
    const { data: userRes } = await supabase.auth.getUser();
    const coach_id = userRes.user?.id;
    if (!coach_id) return;
    const { error } = await supabase.from("workout_plans").insert({
      coach_id,
      name: form.name.trim(),
      description: form.description || null,
      default_rest_seconds: Number(form.default_rest_seconds) || 15,
    });
    if (error) return toast.error(error.message);
    toast.success("התוכנית נוצרה");
    setOpen(false);
    setForm(emptyForm);
    qc.invalidateQueries({ queryKey: ["workout-plans"] });
  };

  const remove = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("למחוק את התוכנית?")) return;
    const { error } = await supabase.from("workout_plans").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("נמחקה");
    qc.invalidateQueries({ queryKey: ["workout-plans"] });
  };

  const estimateSeconds = (p: any) => {
    const items = p.workout_plan_items ?? [];
    return items.reduce((sum: number, it: any, idx: number) => {
      const dur = it.duration_seconds ?? 30;
      const rest =
        idx < items.length - 1 ? (it.rest_after_seconds ?? p.default_rest_seconds ?? 15) : 0;
      return sum + dur + rest;
    }, 0);
  };

  const fmt = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">תוכניות אימון</h1>
          <p className="text-sm text-muted-foreground mt-1">בנה רצפי תרגילים והפעל אימון חי</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 ml-1" /> תוכנית חדשה
        </Button>
      </div>

      {plans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            אין תוכניות אימון עדיין. צור תוכנית ראשונה.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p: any) => (
            <Link
              key={p.id}
              to="/workouts/$workoutId"
              params={{ workoutId: p.id }}
              className="block"
            >
              <Card className="h-full hover:shadow-md hover:border-primary/40 transition-all">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-base truncate">{p.name}</div>
                      {p.description && (
                        <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {p.description}
                        </div>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="flex-shrink-0"
                      onClick={(e) => remove(p.id, e)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                    <div className="flex items-center gap-1.5">
                      <ListChecks className="h-3.5 w-3.5" /> {(p.workout_plan_items ?? []).length}{" "}
                      תרגילים
                    </div>
                    <div>~{fmt(estimateSeconds(p))} דק'</div>
                  </div>
                  <div className="flex items-center justify-end text-primary text-sm font-medium">
                    פתח <ChevronLeft className="h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>תוכנית אימון חדשה</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>שם תוכנית *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>תיאור</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div>
              <Label>הפסקת ברירת מחדל בין תרגילים (שניות)</Label>
              <Input
                type="number"
                min={0}
                value={form.default_rest_seconds}
                onChange={(e) => setForm({ ...form, default_rest_seconds: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              ביטול
            </Button>
            <Button onClick={create}>צור תוכנית</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
