import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileSpreadsheet, Printer, CloudUpload, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { createGoogleSpreadsheet, getFreshAccessToken, loadGoogleAccount } from "@/lib/backup-data";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
  head: () => ({
    meta: [
      { title: "דוחות נוכחות — מאמן" },
      { name: "description", content: "הפקת דוח נוכחות חודשי או שנתי לכל חניך וקבוצה, ייצוא ל-PDF, Excel או Google Drive" },
      { property: "og:title", content: "דוחות נוכחות — מאמן" },
      { property: "og:description", content: "הפקת דוח נוכחות חודשי או שנתי לכל חניך וקבוצה" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

function ReportsPage() {
  const now = new Date();
  const [mode, setMode] = useState<"month" | "year">("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [groupId, setGroupId] = useState<string>("all");
  const [studentId, setStudentId] = useState<string>("all");
  const [sending, setSending] = useState(false);

  const { from, to, periodLabel } = useMemo(() => {
    if (mode === "month") {
      return {
        from: iso(new Date(year, month, 1)),
        to: iso(new Date(year, month + 1, 0)),
        periodLabel: `${MONTHS[month]} ${year}`,
      };
    }
    return { from: `${year}-01-01`, to: `${year}-12-31`, periodLabel: `שנת ${year}` };
  }, [mode, year, month]);

  const { data: groups = [] } = useQuery({
    queryKey: ["groups-simple"],
    queryFn: async () =>
      (await supabase.from("groups").select("id, name, color").order("name")).data ?? [],
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students-simple"],
    queryFn: async () =>
      (await supabase.from("students").select("id, full_name").order("full_name")).data ?? [],
  });

  const { data: report, isLoading } = useQuery({
    queryKey: ["attendance-report", from, to, groupId, studentId],
    queryFn: async () => {
      let lessonsQ = supabase
        .from("lessons")
        .select("id, lesson_date, group_id, groups(name)")
        .gte("lesson_date", from)
        .lte("lesson_date", to);
      if (groupId !== "all") lessonsQ = lessonsQ.eq("group_id", groupId);
      const { data: lessons, error: le } = await lessonsQ;
      if (le) throw le;

      const lessonIds = (lessons ?? []).map((l: any) => l.id);
      let attendance: any[] = [];
      if (lessonIds.length) {
        let attQ = supabase
          .from("attendance")
          .select("lesson_id, student_id, status, students(full_name)")
          .in("lesson_id", lessonIds);
        if (studentId !== "all") attQ = attQ.eq("student_id", studentId);
        const { data, error } = await attQ;
        if (error) throw error;
        attendance = data ?? [];
      }

      const lessonById = new Map((lessons ?? []).map((l: any) => [l.id, l]));
      const lessonsPerGroup = new Map<string, number>();
      for (const l of lessons ?? []) {
        lessonsPerGroup.set(l.group_id, (lessonsPerGroup.get(l.group_id) ?? 0) + 1);
      }

      type Row = {
        key: string;
        student: string;
        group: string;
        present: number;
        absent: number;
        lessons: number;
      };
      const map = new Map<string, Row>();
      for (const a of attendance) {
        const lesson = lessonById.get(a.lesson_id);
        if (!lesson) continue;
        const key = `${a.student_id}|${lesson.group_id}`;
        const row =
          map.get(key) ??
          {
            key,
            student: a.students?.full_name ?? "",
            group: lesson.groups?.name ?? "",
            present: 0,
            absent: 0,
            lessons: lessonsPerGroup.get(lesson.group_id) ?? 0,
          };
        if (a.status === "absent") row.absent += 1;
        else row.present += 1;
        map.set(key, row);
      }

      const rows = [...map.values()].sort(
        (a, b) =>
          a.group.localeCompare(b.group, "he") || a.student.localeCompare(b.student, "he"),
      );
      return { rows, totalLessons: lessons?.length ?? 0 };
    },
  });

  const rows = report?.rows ?? [];

  const sheetRows = rows.map((r) => ({
    חניך: r.student,
    קבוצה: r.group,
    "שיעורים בתקופה": r.lessons,
    נוכח: r.present,
    נעדר: r.absent,
    "אחוז נוכחות": r.lessons ? `${Math.round((r.present / r.lessons) * 100)}%` : "—",
  }));

  const fileTitle = `דוח נוכחות ${periodLabel}${groupId !== "all" ? " - " + (groups.find((g: any) => g.id === groupId)?.name ?? "") : ""}`;

  const exportExcel = () => {
    if (!sheetRows.length) return toast.error("אין נתונים לייצוא");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetRows), "נוכחות");
    XLSX.writeFile(wb, `${fileTitle}.xlsx`);
    toast.success("הקובץ הורד");
  };

  const exportToDrive = async () => {
    setSending(true);
    try {
      if (!sheetRows.length) throw new Error("אין נתונים לייצוא");
      const account = await loadGoogleAccount();
      if (!account) throw new Error("יש לחבר חשבון Google בדף גיבוי וייבוא");
      const token = await getFreshAccessToken(account);
      const res = await createGoogleSpreadsheet(token, fileTitle, [
        { name: "נוכחות", rows: sheetRows },
      ]);
      toast.success("הדוח נשמר ב-Google Drive");
      window.open(res.spreadsheetUrl, "_blank");
    } catch (err: any) {
      toast.error(err.message ?? "שגיאה בשמירה ל-Drive");
    } finally {
      setSending(false);
    }
  };

  // PDF is produced through the browser's print dialog ("שמור כ-PDF") so Hebrew
  // renders correctly without embedding fonts.
  const exportPdf = () => {
    if (!sheetRows.length) return toast.error("אין נתונים לייצוא");
    const headers = Object.keys(sheetRows[0]);
    const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
      <title>${fileTitle}</title>
      <style>
        body{font-family:Heebo,Arial,sans-serif;padding:24px;color:#111}
        h1{font-size:20px;margin:0 0 4px}
        p{margin:0 0 16px;color:#555;font-size:13px}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th,td{border:1px solid #ccc;padding:6px 8px;text-align:right}
        th{background:#f1f5f9}
      </style></head><body>
      <h1>${fileTitle}</h1>
      <p>הופק בתאריך ${new Date().toLocaleDateString("he-IL")}</p>
      <table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${sheetRows
        .map((r: any) => `<tr>${headers.map((h) => `<td>${r[h] ?? ""}</td>`).join("")}</tr>`)
        .join("")}</tbody></table>
      <script>window.onload=()=>window.print()<\/script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) return toast.error("החלון נחסם על ידי הדפדפן");
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">דוחות נוכחות</h1>
        <p className="text-sm text-muted-foreground mt-1">
          הפקת דוח נוכחות לכל חניך ולכל קבוצה, לפי חודש או שנה
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">הגדרות דוח</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button variant={mode === "month" ? "default" : "outline"} onClick={() => setMode("month")}>
              חודשי
            </Button>
            <Button variant={mode === "year" ? "default" : "outline"} onClick={() => setMode("year")}>
              שנתי
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              onClick={() => {
                if (mode === "year") return setYear(year - 1);
                if (month === 0) {
                  setMonth(11);
                  setYear(year - 1);
                } else setMonth(month - 1);
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="flex-1 text-center font-semibold">{periodLabel}</div>
            <Button
              size="icon"
              variant="outline"
              onClick={() => {
                if (mode === "year") return setYear(year + 1);
                if (month === 11) {
                  setMonth(0);
                  setYear(year + 1);
                } else setMonth(month + 1);
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>קבוצה</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הקבוצות</SelectItem>
                  {groups.map((g: any) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>חניך</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל החניכים</SelectItem>
                  {students.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" onClick={exportPdf}>
              <Printer className="h-4 w-4 ml-1" /> PDF
            </Button>
            <Button variant="outline" onClick={exportExcel}>
              <FileSpreadsheet className="h-4 w-4 ml-1" /> Excel
            </Button>
            <Button onClick={exportToDrive} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <CloudUpload className="h-4 w-4 ml-1" />}
              שמור ל-Drive
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {periodLabel} · {report?.totalLessons ?? 0} שיעורים
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-6">טוען…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">אין נתוני נוכחות בתקופה זו</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-muted-foreground border-b">
                  <th className="py-2 font-medium">חניך</th>
                  <th className="py-2 font-medium">קבוצה</th>
                  <th className="py-2 font-medium">שיעורים</th>
                  <th className="py-2 font-medium">נוכח</th>
                  <th className="py-2 font-medium">נעדר</th>
                  <th className="py-2 font-medium">אחוז</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-b last:border-0">
                    <td className="py-2 font-medium">{r.student}</td>
                    <td className="py-2 text-muted-foreground">{r.group}</td>
                    <td className="py-2 tabular-nums">{r.lessons}</td>
                    <td className="py-2 tabular-nums text-emerald-600">{r.present}</td>
                    <td className="py-2 tabular-nums text-destructive">{r.absent}</td>
                    <td className="py-2 tabular-nums">
                      {r.lessons ? `${Math.round((r.present / r.lessons) * 100)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
