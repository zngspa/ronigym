import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Settings2,
  Dumbbell,
  Clock,
  ImagePlus,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/exercises")({
  component: ExercisesPage,
  head: () => ({ meta: [{ title: "תרגילים — מאמן" }] }),
});

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6"];
const NO_CATEGORY = "__none__";

const emptyExerciseForm = {
  name: "",
  description: "",
  category_id: NO_CATEGORY,
  default_duration_seconds: "30",
  image_url: "" as string | null,
  video_url: "" as string | null,
};

function ExercisesPage() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [catManagerOpen, setCatManagerOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState(COLORS[0]);
  const [editingCat, setEditingCat] = useState<any>(null);

  const [exOpen, setExOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<any>(null);
  const [exForm, setExForm] = useState(emptyExerciseForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ["exercise-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercise_categories")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: exercises = [] } = useQuery({
    queryKey: ["exercises"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercises")
        .select("*, exercise_categories(id, name, color)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    let list = exercises;
    if (activeCategory !== "all") {
      list = list.filter((e: any) => e.category_id === activeCategory);
    }
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter(
        (e: any) => e.name?.toLowerCase().includes(s) || e.description?.toLowerCase().includes(s),
      );
    }
    return list;
  }, [exercises, activeCategory, search]);

  const getCoachId = async () => {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  };

  // --- Categories ---
  const createCategory = async () => {
    if (!newCatName.trim()) return toast.error("נדרש שם קטגוריה");
    const coach_id = await getCoachId();
    if (!coach_id) return;
    const { error } = await supabase
      .from("exercise_categories")
      .insert({ coach_id, name: newCatName.trim(), color: newCatColor });
    if (error) return toast.error(error.message);
    setNewCatName("");
    setNewCatColor(COLORS[0]);
    toast.success("קטגוריה נוצרה");
    qc.invalidateQueries({ queryKey: ["exercise-categories"] });
  };

  const saveCategory = async () => {
    if (!editingCat?.name?.trim()) return toast.error("נדרש שם קטגוריה");
    const { error } = await supabase
      .from("exercise_categories")
      .update({ name: editingCat.name.trim(), color: editingCat.color })
      .eq("id", editingCat.id);
    if (error) return toast.error(error.message);
    setEditingCat(null);
    toast.success("קטגוריה עודכנה");
    qc.invalidateQueries({ queryKey: ["exercise-categories"] });
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("למחוק את הקטגוריה? התרגילים ישויכו ל'ללא קטגוריה'.")) return;
    const { error } = await supabase.from("exercise_categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("הקטגוריה נמחקה");
    if (activeCategory === id) setActiveCategory("all");
    qc.invalidateQueries({ queryKey: ["exercise-categories"] });
    qc.invalidateQueries({ queryKey: ["exercises"] });
  };

  // --- Exercises ---
  const openNewExercise = () => {
    setEditingExercise(null);
    setExForm({
      ...emptyExerciseForm,
      category_id: activeCategory !== "all" ? activeCategory : NO_CATEGORY,
    });
    setImageFile(null);
    setImagePreview(null);
    setVideoFile(null);
    setVideoPreview(null);
    setExOpen(true);
  };

  const openEditExercise = (e: any) => {
    setEditingExercise(e);
    setExForm({
      name: e.name,
      description: e.description ?? "",
      category_id: e.category_id ?? NO_CATEGORY,
      default_duration_seconds: String(e.default_duration_seconds ?? 30),
      image_url: e.image_url ?? null,
      video_url: e.video_url ?? null,
    });
    setImageFile(null);
    setImagePreview(e.image_url ?? null);
    setVideoFile(null);
    setVideoPreview(e.video_url ?? null);
    setExOpen(true);
  };

  const onPickImage = (file: File | null) => {
    setImageFile(file);
    if (file) setImagePreview(URL.createObjectURL(file));
  };

  const onPasteImageUrl = (url: string) => {
    setImageFile(null);
    setExForm((prev) => ({ ...prev, image_url: url || null }));
    setImagePreview(url || null);
  };

  const onPickVideo = (file: File | null) => {
    setVideoFile(file);
    if (file) setVideoPreview(URL.createObjectURL(file));
  };

  const onPasteVideoUrl = (url: string) => {
    setVideoFile(null);
    setExForm((prev) => ({ ...prev, video_url: url || null }));
    setVideoPreview(url || null);
  };

  const safeExtension = (filename: string, fallback: string) => {
    const raw = filename.split(".").pop() ?? "";
    const cleaned = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
    return cleaned || fallback;
  };

  const saveExercise = async () => {
    if (!exForm.name.trim()) return toast.error("נדרש שם תרגיל");
    const coach_id = await getCoachId();
    if (!coach_id) return;

    setUploading(true);
    try {
      let image_url = exForm.image_url;
      if (imageFile) {
        const ext = safeExtension(imageFile.name, "jpg");
        const path = `${coach_id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("exercise-images")
          .upload(path, imageFile, { upsert: true, contentType: imageFile.type || undefined });
        if (upErr) throw upErr;
        image_url = supabase.storage.from("exercise-images").getPublicUrl(path).data.publicUrl;
      }

      let video_url = exForm.video_url;
      if (videoFile) {
        const ext = safeExtension(videoFile.name, "mp4");
        const path = `${coach_id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("exercise-images")
          .upload(path, videoFile, { upsert: true, contentType: videoFile.type || undefined });
        if (upErr) throw upErr;
        video_url = supabase.storage.from("exercise-images").getPublicUrl(path).data.publicUrl;
      }

      const payload = {
        name: exForm.name.trim(),
        description: exForm.description || null,
        category_id: exForm.category_id === NO_CATEGORY ? null : exForm.category_id,
        default_duration_seconds: Number(exForm.default_duration_seconds) || 30,
        image_url,
        video_url,
      };

      if (editingExercise) {
        const { error } = await supabase
          .from("exercises")
          .update(payload)
          .eq("id", editingExercise.id);
        if (error) throw error;
        toast.success("התרגיל עודכן");
      } else {
        const { error } = await supabase.from("exercises").insert({ ...payload, coach_id });
        if (error) throw error;
        toast.success("התרגיל נוצר");
      }
      setExOpen(false);
      qc.invalidateQueries({ queryKey: ["exercises"] });
    } catch (err: any) {
      toast.error(err.message ?? "שגיאה בשמירה");
    } finally {
      setUploading(false);
    }
  };

  const deleteExercise = async (id: string) => {
    if (!confirm("למחוק את התרגיל?")) return;
    const { error } = await supabase.from("exercises").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("נמחק");
    qc.invalidateQueries({ queryKey: ["exercises"] });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">תרגילים</h1>
          <p className="text-sm text-muted-foreground mt-1">
            ספריית התרגילים שלך, מסודרת לפי קטגוריות
          </p>
        </div>
        <Button onClick={openNewExercise}>
          <Plus className="h-4 w-4 ml-1" /> תרגיל חדש
        </Button>
      </div>

      {/* Category chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveCategory("all")}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm border transition-colors ${
            activeCategory === "all"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted/50 border-transparent hover:bg-muted"
          }`}
        >
          הכל ({exercises.length})
        </button>
        {categories.map((c: any) => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.id)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${
              activeCategory === c.id
                ? "text-white border-transparent"
                : "bg-muted/50 border-transparent hover:bg-muted"
            }`}
            style={activeCategory === c.id ? { backgroundColor: c.color } : undefined}
          >
            <span
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: c.color }}
            />
            {c.name}
          </button>
        ))}
        <button
          onClick={() => setCatManagerOpen(true)}
          className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-sm border border-dashed text-muted-foreground hover:bg-muted"
        >
          <Settings2 className="h-3.5 w-3.5" /> קטגוריות
        </button>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש תרגיל"
          className="pr-10"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {exercises.length === 0 ? "אין תרגילים עדיין. הוסף תרגיל ראשון." : "לא נמצאו תוצאות"}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e: any) => (
            <Card key={e.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <div className="aspect-video bg-muted grid place-items-center overflow-hidden">
                {e.video_url ? (
                  <video
                    src={e.video_url}
                    className="h-full w-full object-cover"
                    autoPlay
                    muted
                    loop
                    playsInline
                  />
                ) : e.image_url ? (
                  <img src={e.image_url} alt={e.name} className="h-full w-full object-cover" />
                ) : (
                  <Dumbbell className="h-8 w-8 text-muted-foreground/40" />
                )}
              </div>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-sm">{e.name}</div>
                  <div className="flex gap-0.5 -mt-1 -mr-1 flex-shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => openEditExercise(e)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => deleteExercise(e.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
                {e.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{e.description}</p>
                )}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {e.exercise_categories && (
                    <Badge
                      variant="secondary"
                      className="gap-1 text-white"
                      style={{ backgroundColor: e.exercise_categories.color }}
                    >
                      {e.exercise_categories.name}
                    </Badge>
                  )}
                  <Badge variant="outline" className="gap-1">
                    <Clock className="h-3 w-3" /> {e.default_duration_seconds} שנ'
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Category manager dialog */}
      <Dialog open={catManagerOpen} onOpenChange={setCatManagerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ניהול קטגוריות</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {categories.length === 0 && (
                <p className="text-sm text-muted-foreground">אין קטגוריות עדיין</p>
              )}
              {categories.map((c: any) =>
                editingCat?.id === c.id ? (
                  <div key={c.id} className="flex items-center gap-2 p-2 border rounded-lg">
                    <Input
                      value={editingCat.name}
                      onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })}
                      className="h-8"
                    />
                    <div className="flex gap-1 flex-shrink-0">
                      {COLORS.map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setEditingCat({ ...editingCat, color: col })}
                          className={`h-6 w-6 rounded-full border-2 ${editingCat.color === col ? "border-foreground" : "border-transparent"}`}
                          style={{ backgroundColor: col }}
                        />
                      ))}
                    </div>
                    <Button size="sm" onClick={saveCategory}>
                      שמור
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingCat(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-2 p-2 border rounded-lg"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: c.color }}
                      />
                      <span className="text-sm truncate">{c.name}</span>
                    </div>
                    <div className="flex gap-0.5 flex-shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => setEditingCat({ id: c.id, name: c.name, color: c.color })}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => deleteCategory(c.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ),
              )}
            </div>
            <div className="flex items-center gap-2 pt-2 border-t">
              <Input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="שם קטגוריה חדשה"
                className="h-9"
              />
              <div className="flex gap-1 flex-shrink-0">
                {COLORS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setNewCatColor(col)}
                    className={`h-6 w-6 rounded-full border-2 ${newCatColor === col ? "border-foreground" : "border-transparent"}`}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
              <Button size="sm" onClick={createCategory}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatManagerOpen(false)}>
              סגור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New / edit exercise dialog */}
      <Dialog open={exOpen} onOpenChange={setExOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingExercise ? "עריכת תרגיל" : "תרגיל חדש"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>תמונה / GIF</Label>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="h-20 w-20 rounded-lg bg-muted grid place-items-center overflow-hidden flex-shrink-0">
                  {imagePreview ? (
                    <img src={imagePreview} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlus className="h-6 w-6 text-muted-foreground/50" />
                  )}
                </div>
                <div className="flex-1 space-y-1.5 min-w-0">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp,image/*,.png,.jpg,.jpeg,.gif,.webp"
                    hidden
                    onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    בחר תמונה / GIF מהמחשב
                  </Button>
                  <div className="text-xs text-muted-foreground">או הדבק קישור ל-GIF/תמונה:</div>
                  <Input
                    className="h-8"
                    placeholder="https://example.com/exercise.gif"
                    value={imageFile ? "" : (exForm.image_url ?? "")}
                    onChange={(e) => onPasteImageUrl(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div>
              <Label>סרטון (MP4)</Label>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="h-20 w-20 rounded-lg bg-muted grid place-items-center overflow-hidden flex-shrink-0">
                  {videoPreview ? (
                    <video
                      src={videoPreview}
                      className="h-full w-full object-cover"
                      muted
                      loop
                      autoPlay
                      playsInline
                    />
                  ) : (
                    <Video className="h-6 w-6 text-muted-foreground/50" />
                  )}
                </div>
                <div className="flex-1 space-y-1.5 min-w-0">
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/mp4,.mp4,video/*"
                    hidden
                    onChange={(e) => onPickVideo(e.target.files?.[0] ?? null)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => videoInputRef.current?.click()}
                  >
                    בחר סרטון MP4 מהמחשב
                  </Button>
                  <div className="text-xs text-muted-foreground">או הדבק קישור לסרטון:</div>
                  <Input
                    className="h-8"
                    placeholder="https://example.com/exercise.mp4"
                    value={videoFile ? "" : (exForm.video_url ?? "")}
                    onChange={(e) => onPasteVideoUrl(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                אם יש גם תמונה וגם סרטון - הסרטון יוצג בעדיפות.
              </p>
            </div>
            <div>
              <Label>שם תרגיל *</Label>
              <Input
                value={exForm.name}
                onChange={(e) => setExForm({ ...exForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label>תיאור</Label>
              <Textarea
                value={exForm.description}
                onChange={(e) => setExForm({ ...exForm, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>קטגוריה</Label>
                <Select
                  value={exForm.category_id}
                  onValueChange={(v) => setExForm({ ...exForm, category_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CATEGORY}>ללא קטגוריה</SelectItem>
                    {categories.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>משך ברירת מחדל (שניות)</Label>
                <Input
                  type="number"
                  min={1}
                  value={exForm.default_duration_seconds}
                  onChange={(e) =>
                    setExForm({ ...exForm, default_duration_seconds: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExOpen(false)}>
              ביטול
            </Button>
            <Button onClick={saveExercise} disabled={uploading}>
              {uploading ? "שומר..." : "שמור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
