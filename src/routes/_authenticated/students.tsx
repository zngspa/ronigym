import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Phone, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/students")({
  component: StudentsPage,
  head: () => ({ meta: [{ title: "חניכים — מאמן" }] }),
});

function StudentsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", monthly_fee: "" });

  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

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
    const { error } = await supabase.from("students").insert({
      coach_id,
      full_name: form.full_name,
      phone: form.phone || null,
      email: form.email || null,
      monthly_fee: form.monthly_fee ? Number(form.monthly_fee) : 0,
    });
    if (error) return toast.error(error.message);
    toast.success("חניך נוסף");
    setOpen(false);
    setForm({ full_name: "", phone: "", email: "", monthly_fee: "" });
    qc.invalidateQueries({ queryKey: ["students"] });
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
            <Link key={s.id} to="/students/$studentId" params={{ studentId: s.id }}>
              <Card className="hover:shadow-md hover:border-primary/40 transition-all">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-11 w-11 rounded-full bg-primary/10 text-primary grid place-items-center font-semibold flex-shrink-0">
                      {s.full_name?.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{s.full_name}</div>
                      {s.phone && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3" /> {s.phone}
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
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
            <p className="text-xs text-muted-foreground">שאר הפרטים (ת.ז, סוג דם, בריאות וכו') ניתן להזין בכרטיס האישי לאחר היצירה.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
            <Button onClick={create}>הוסף</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}