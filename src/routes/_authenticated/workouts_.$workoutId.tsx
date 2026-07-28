import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowRight,
  Plus,
  Trash2,
  GripVertical,
  Play,
  Clock,
  Dumbbell,
  ChevronLeft,
  Pencil,
  Save,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { WorkoutPlayer, type PlayerItem } from "@/components/workout-player";

export const Route = createFileRoute("/_authenticated/workouts_/$workoutId")({
  component: WorkoutBuilderPage,
  head: () => ({ meta: [{ title: "בניית תוכנית אימון — מאמן" }] }),
});

type Row = {
  id: string;
  position: number;
  duration_seconds: number | null;
  rest_after_seconds: number | null;
  exercise: {
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    video_url: string | null;
    default_duration_seconds: number;
    exercise_categories: { name: string; color: string } | null;
  };
};

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function SortableRow({
  row,
  index,
  onChange,
  onRemove,
  onEdit,
}: {
  row: Row;
  index: number;
  onChange: (id: string, patch: Partial<Row>) => void;
  onRemove: (id: string) => void;
  onEdit: (row: Row) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const cat = row.exercise.exercise_categories;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-3 border rounded-lg bg-card"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground touch-none flex-shrink-0"
        aria-label="גרור לשינוי סדר"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="h-7 w-7 rounded-full bg-muted grid place-items-center text-xs font-semibold flex-shrink-0">
        {index + 1}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{row.exercise.name}</div>
        {cat && (
          <Badge
            variant="secondary"
            className="text-[10px] h-4 px-1.5 mt-0.5 text-white"
            style={{ backgroundColor: cat.color }}
          >
            {cat.name}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Label className="text-xs text-muted-foreground">משך</Label>
        <Input
          type="number"
          min={1}
          className="h-8 w-16 text-center"
          value={row.duration_seconds ?? row.exercise.default_duration_seconds}
          onChange={(e) => onChange(row.id, { duration_seconds: Number(e.target.value) || 1 })}
        />
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Label className="text-xs text-muted-foreground">הפסקה</Label>
        <Input
          type="number"
          min={0}
          className="h-8 w-16 text-center"
          value={row.rest_after_seconds ?? ""}
          placeholder="ברירת מחדל"
          onChange={(e) =>
            onChange(row.id, {
              rest_after_seconds: e.target.value === "" ? null : Number(e.target.value),
            })
          }
        />
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="flex-shrink-0"
        onClick={() => onEdit(row)}
        aria-label="ערוך תרגיל"
      >
        <Pencil className="h-4 w-4 text-muted-foreground" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="flex-shrink-0"
        onClick={() => onRemove(row.id)}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

function WorkoutBuilderPage() {
  const { workoutId } = Route.useParams();
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [playing, setPlaying] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addCategory, setAddCategory] = useState<string>("all");
  const [editEx, setEditEx] = useState<any>(null);
  const dirtyIds = useRef<Set<string>>(new Set());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: plan } = useQuery({
    queryKey: ["workout-plan", workoutId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_plans")
        .select("*")
        .eq("id", workoutId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["workout-plan-items", workoutId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_plan_items")
        .select(
          "*, exercises(id, name, description, image_url, video_url, default_duration_seconds, exercise_categories(name, color))",
        )
        .eq("workout_plan_id", workoutId)
        .order("position");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["exercise-categories"],
    queryFn: async () =>
      (await supabase.from("exercise_categories").select("*").order("created_at")).data ?? [],
  });

  const { data: exercises = [] } = useQuery({
    queryKey: ["exercises"],
    queryFn: async () => (await supabase.from("exercises").select("*").order("name")).data ?? [],
  });

  // Keep local rows in sync with the server list (new/removed items, reordering,
  // exercise edits) while preserving in-flight duration/rest edits.
  const serverSignature = useMemo(
    () =>
      JSON.stringify(
        items.map((it: any) => [it.id, it.position, it.exercises?.name, it.exercises?.description, it.exercises?.default_duration_seconds]),
      ),
    [items],
  );
  useEffect(() => {
    setRows((prev) => {
      const prevById = new Map(prev.map((r) => [r.id, r]));
      return items.map((it: any) => {
        const existing = prevById.get(it.id);
        return {
          id: it.id,
          position: it.position,
          duration_seconds: existing ? existing.duration_seconds : it.duration_seconds,
          rest_after_seconds: existing ? existing.rest_after_seconds : it.rest_after_seconds,
          exercise: it.exercises,
        };
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSignature, workoutId]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const persistOrder = async (newRows: Row[]) => {
    const updates = newRows.map((r, idx) => ({ id: r.id, position: idx }));
    for (const u of updates) {
      await supabase.from("workout_plan_items").update({ position: u.position }).eq("id", u.id);
    }
    qc.invalidateQueries({ queryKey: ["workout-plan-items", workoutId] });
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setRows((prev) => {
      const oldIndex = prev.findIndex((r) => r.id === active.id);
      const newIndex = prev.findIndex((r) => r.id === over.id);
      const next = arrayMove(prev, oldIndex, newIndex);
      persistOrder(next);
      return next;
    });
  };

  const scheduleSave = (id: string, patch: Partial<Row>) => {
    dirtyIds.current.add(id);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const ids = Array.from(dirtyIds.current);
      dirtyIds.current.clear();
      for (const rowId of ids) {
        const row = rows.find((r) => r.id === rowId);
        if (!row) continue;
        await supabase
          .from("workout_plan_items")
          .update({
            duration_seconds: row.duration_seconds,
            rest_after_seconds: row.rest_after_seconds,
          })
          .eq("id", rowId);
      }
    }, 500);
  };

  const updateRow = (id: string, patch: Partial<Row>) => {
    setRows((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, ...patch } : r));
      return next;
    });
    scheduleSave(id, patch);
  };

  const removeRow = async (id: string) => {
    if (!confirm("להסיר את התרגיל מהתוכנית?")) return;
    const { error } = await supabase.from("workout_plan_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows((prev) => prev.filter((r) => r.id !== id));
    qc.invalidateQueries({ queryKey: ["workout-plan-items", workoutId] });
  };

  const addExercise = async (exercise: any) => {
    const { data: userRes } = await supabase.auth.getUser();
    const coach_id = userRes.user?.id;
    if (!coach_id || !plan) return;
    const { error } = await supabase.from("workout_plan_items").insert({
      coach_id,
      workout_plan_id: plan.id,
      exercise_id: exercise.id,
      position: rows.length,
    });
    if (error) return toast.error(error.message);
    toast.success(`${exercise.name} נוסף לתוכנית`);
    await qc.invalidateQueries({ queryKey: ["workout-plan-items", workoutId] });
  };

  const saveExercise = async () => {
    if (!editEx?.id) return;
    if (!String(editEx.name ?? "").trim()) return toast.error("נדרש שם לתרגיל");
    const { error } = await supabase
      .from("exercises")
      .update({
        name: editEx.name.trim(),
        description: editEx.description || null,
        default_duration_seconds: Number(editEx.default_duration_seconds) || 30,
        category_id: editEx.category_id || null,
      })
      .eq("id", editEx.id);
    if (error) return toast.error(error.message);
    toast.success("התרגיל עודכן");
    setEditEx(null);
    qc.invalidateQueries({ queryKey: ["exercises"] });
    qc.invalidateQueries({ queryKey: ["workout-plan-items", workoutId] });
  };

  const saveDefaultRest = async (value: number) => {
    if (!plan) return;
    await supabase.from("workout_plans").update({ default_rest_seconds: value }).eq("id", plan.id);
    qc.invalidateQueries({ queryKey: ["workout-plan", workoutId] });
  };

  const totalSeconds = useMemo(() => {
    return rows.reduce((sum, r, idx) => {
      const dur = r.duration_seconds ?? r.exercise.default_duration_seconds;
      const rest =
        idx < rows.length - 1 ? (r.rest_after_seconds ?? plan?.default_rest_seconds ?? 15) : 0;
      return sum + dur + rest;
    }, 0);
  }, [rows, plan]);

  const filteredExercisesForAdd = useMemo(() => {
    if (addCategory === "all") return exercises;
    return exercises.filter((e: any) => e.category_id === addCategory);
  }, [exercises, addCategory]);

  const playerItems: PlayerItem[] = rows.map((r) => ({
    id: r.id,
    name: r.exercise.name,
    description: r.exercise.description,
    image_url: r.exercise.image_url,
    video_url: r.exercise.video_url,
    durationSeconds: r.duration_seconds ?? r.exercise.default_duration_seconds,
    restAfterSeconds: r.rest_after_seconds ?? plan?.default_rest_seconds ?? 15,
  }));

  if (isLoading || !plan) {
    return <div className="max-w-4xl mx-auto text-center text-muted-foreground py-16">טוען...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/workouts" className="flex items-center gap-1 hover:text-foreground">
          <ArrowRight className="h-4 w-4" /> תוכניות אימון
        </Link>
      </div>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{plan.name}</h1>
          {plan.description && (
            <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
          )}
        </div>
        <Button
          size="lg"
          className="gap-2"
          disabled={rows.length === 0}
          onClick={() => setPlaying(true)}
        >
          <Play className="h-5 w-5" /> הפעל אימון
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">הפסקת ברירת מחדל (שניות)</Label>
            <Input
              type="number"
              min={0}
              className="h-8 w-20"
              defaultValue={plan.default_rest_seconds}
              onBlur={(e) => saveDefaultRest(Number(e.target.value) || 0)}
            />
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" /> זמן משוער:{" "}
            <span className="font-semibold text-foreground">{fmt(totalSeconds)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="font-semibold">רצף התרגילים</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setAddCategory("all");
            setAddOpen(true);
          }}
        >
          <Plus className="h-4 w-4 ml-1" /> הוסף תרגיל
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            אין עדיין תרגילים בתוכנית. הוסף תרגיל ראשון.
          </CardContent>
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {rows.map((row, idx) => (
                <SortableRow
                  key={row.id}
                  row={row}
                  index={idx}
                  onChange={updateRow}
                  onRemove={removeRow}
                  onEdit={(r) =>
                    setEditEx({
                      id: r.exercise.id,
                      name: r.exercise.name,
                      description: r.exercise.description ?? "",
                      default_duration_seconds: r.exercise.default_duration_seconds,
                      category_id: (r.exercise as any).category_id ?? "",
                    })
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add exercise dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>הוספת תרגיל לתוכנית</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setAddCategory("all")}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs border ${addCategory === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 border-transparent"}`}
              >
                הכל
              </button>
              {categories.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => setAddCategory(c.id)}
                  className={`flex-shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-xs border ${addCategory === c.id ? "text-white border-transparent" : "bg-muted/50 border-transparent"}`}
                  style={addCategory === c.id ? { backgroundColor: c.color } : undefined}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </button>
              ))}
            </div>
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {filteredExercisesForAdd.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  אין תרגילים בקטגוריה זו
                </p>
              ) : (
                filteredExercisesForAdd.map((e: any) => (
                  <button
                    key={e.id}
                    onClick={() => addExercise(e)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg border hover:bg-muted/60 text-right transition-colors"
                  >
                    <div className="h-10 w-10 rounded-md bg-muted grid place-items-center overflow-hidden flex-shrink-0">
                      {e.image_url ? (
                        <img src={e.image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Dumbbell className="h-4 w-4 text-muted-foreground/50" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{e.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {e.default_duration_seconds} שנ'
                      </div>
                    </div>
                    <ChevronLeft className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              סגור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {playing && (
        <WorkoutPlayer planName={plan.name} items={playerItems} onClose={() => setPlaying(false)} />
      )}

      {/* Edit exercise dialog */}
      <Dialog open={!!editEx} onOpenChange={(o) => !o && setEditEx(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>עריכת תרגיל</DialogTitle>
          </DialogHeader>
          {editEx && (
            <div className="space-y-3">
              <div>
                <Label>שם התרגיל *</Label>
                <Input
                  value={editEx.name}
                  onChange={(e) => setEditEx({ ...editEx, name: e.target.value })}
                />
              </div>
              <div>
                <Label>תיאור</Label>
                <Textarea
                  rows={3}
                  value={editEx.description}
                  onChange={(e) => setEditEx({ ...editEx, description: e.target.value })}
                />
              </div>
              <div>
                <Label>משך ברירת מחדל (שניות)</Label>
                <Input
                  type="number"
                  min={1}
                  value={editEx.default_duration_seconds}
                  onChange={(e) =>
                    setEditEx({ ...editEx, default_duration_seconds: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>קטגוריה</Label>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <button
                    onClick={() => setEditEx({ ...editEx, category_id: "" })}
                    className={`px-3 py-1 rounded-full text-xs border ${!editEx.category_id ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 border-transparent"}`}
                  >
                    ללא
                  </button>
                  {categories.map((c: any) => (
                    <button
                      key={c.id}
                      onClick={() => setEditEx({ ...editEx, category_id: c.id })}
                      className={`px-3 py-1 rounded-full text-xs border ${editEx.category_id === c.id ? "text-white border-transparent" : "bg-muted/50 border-transparent"}`}
                      style={editEx.category_id === c.id ? { backgroundColor: c.color } : undefined}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                לעדכון תמונה/וידאו לתרגיל — בדף "תרגילים".
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEx(null)}>
              ביטול
            </Button>
            <Button onClick={saveExercise}>
              <Save className="h-4 w-4 ml-1" /> שמור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
