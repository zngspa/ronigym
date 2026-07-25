import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Download,
  Upload,
  FileSpreadsheet,
  Loader2,
  CloudCog,
  Unlink,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { GOOGLE_SCOPES, refreshGoogleToken } from "@/lib/google-auth";

export const Route = createFileRoute("/_authenticated/backup")({
  component: BackupPage,
  head: () => ({ meta: [{ title: "גיבוי וייבוא — מאמן" }] }),
});

const STATUS_HE: Record<string, string> = {
  present: "נוכח",
  absent: "נעדר",
  late: "איחור",
  excused: "פטור",
};

const yn = (v: boolean | null | undefined) => (v ? "כן" : "לא");
const parseYn = (v: any) => {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  return ["כן", "true", "1", "yes", "y"].includes(s);
};
const str = (v: any) => (v === undefined || v === null ? "" : String(v).trim());
const numOrNull = (v: any) => {
  const s = str(v);
  if (!s) return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
};

async function getCoachId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function download(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

function BackupPage() {
  const qc = useQueryClient();
  const [exporting, setExporting] = useState(false);
  const [studentsPreview, setStudentsPreview] = useState<any[] | null>(null);
  const [groupsPreview, setGroupsPreview] = useState<any[] | null>(null);
  const [importingStudents, setImportingStudents] = useState(false);
  const [importingGroups, setImportingGroups] = useState(false);
  const [exportingToSheets, setExportingToSheets] = useState(false);
  const studentsFileRef = useRef<HTMLInputElement>(null);
  const groupsFileRef = useRef<HTMLInputElement>(null);

  const { data: googleAccount, isLoading: loadingGoogle } = useQuery({
    queryKey: ["google-account"],
    queryFn: async () => {
      const coach_id = await getCoachId();
      if (!coach_id) return null;
      const { data } = await supabase
        .from("google_accounts")
        .select("*")
        .eq("coach_id", coach_id)
        .maybeSingle();
      return data;
    },
  });

  const connectGoogle = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const redirectUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      toast.error("חיבור Google אינו מוגדר (חסרים משתני סביבה)");
      return;
    }
    const state = crypto.randomUUID();
    sessionStorage.setItem("google_oauth_state", state);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      scope: GOOGLE_SCOPES,
      state,
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  const disconnectGoogle = async () => {
    const coach_id = await getCoachId();
    if (!coach_id) return;
    const { error } = await supabase.from("google_accounts").delete().eq("coach_id", coach_id);
    if (error) return toast.error(error.message);
    toast.success("החיבור ל-Google נותק");
    qc.invalidateQueries({ queryKey: ["google-account"] });
  };

  const getFreshAccessToken = async () => {
    if (!googleAccount) throw new Error("לא מחובר ל-Google");
    const expiresAt = googleAccount.expires_at ? new Date(googleAccount.expires_at).getTime() : 0;
    if (expiresAt > Date.now() + 60_000) return googleAccount.access_token;
    if (!googleAccount.refresh_token) {
      throw new Error("החיבור ל-Google פג תוקף. יש להתחבר מחדש.");
    }
    const refreshed = await refreshGoogleToken({
      data: { refreshToken: googleAccount.refresh_token },
    });
    const expires_at = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await supabase
      .from("google_accounts")
      .update({ access_token: refreshed.access_token, expires_at })
      .eq("coach_id", googleAccount.coach_id);
    qc.invalidateQueries({ queryKey: ["google-account"] });
    return refreshed.access_token;
  };

  const exportToGoogleSheets = async () => {
    setExportingToSheets(true);
    try {
      const accessToken = await getFreshAccessToken();
      const sheets = await buildBackupSheets();
      const today = new Date().toISOString().slice(0, 10);

      const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: { title: `גיבוי מאמן ${today}` },
          sheets: sheets.map((s) => ({ properties: { title: s.name } })),
        }),
      });
      const created: any = await createRes.json();
      if (!createRes.ok) {
        throw new Error(created.error?.message ?? "שגיאה ביצירת קובץ Google Sheets");
      }

      for (const sheet of sheets) {
        if (sheet.rows.length === 0) continue;
        const headers = Object.keys(sheet.rows[0]);
        const values = [headers, ...sheet.rows.map((r: any) => headers.map((h) => r[h] ?? ""))];
        const range = encodeURIComponent(`${sheet.name}!A1`);
        const updateRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${created.spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ values }),
          },
        );
        if (!updateRes.ok) {
          const updateErr: any = await updateRes.json();
          throw new Error(updateErr.error?.message ?? `שגיאה בכתיבת גיליון ${sheet.name}`);
        }
      }

      toast.success("הגיבוי נוצר בהצלחה ב-Google Drive שלך");
      window.open(created.spreadsheetUrl, "_blank");
    } catch (err: any) {
      toast.error(err.message ?? "שגיאה בייצוא ל-Google Sheets");
    } finally {
      setExportingToSheets(false);
    }
  };

  // Fetches every table and shapes it into { name, rows }[] — shared by both the local
  // Excel download and the direct-to-Google-Sheets export.
  const buildBackupSheets = async () => {
    const [
      { data: students, error: e1 },
      { data: groups, error: e2 },
      { data: lessons, error: e3 },
      { data: attendance, error: e4 },
      { data: categories, error: e5 },
      { data: exercises, error: e6 },
      { data: plans, error: e7 },
      { data: planItems, error: e8 },
    ] = await Promise.all([
      supabase.from("students").select("*").order("full_name"),
      supabase.from("groups").select("*").order("name"),
      supabase.from("lessons").select("*, groups(name)").order("lesson_date", { ascending: false }),
      supabase
        .from("attendance")
        .select("*, lessons(lesson_date, groups(name)), students(full_name)")
        .order("created_at", { ascending: false }),
      supabase.from("exercise_categories").select("*").order("name"),
      supabase.from("exercises").select("*, exercise_categories(name)").order("name"),
      supabase.from("workout_plans").select("*").order("name"),
      supabase
        .from("workout_plan_items")
        .select("*, exercises(name), workout_plans(name)")
        .order("position"),
    ]);
    const err = e1 || e2 || e3 || e4 || e5 || e6 || e7 || e8;
    if (err) throw err;

    return [
      {
        name: "חניכים",
        rows: (students ?? []).map((s: any) => ({
          "שם מלא": s.full_name,
          טלפון: s.phone ?? "",
          אימייל: s.email ?? "",
          'ת"ז': s.id_number ?? "",
          "תאריך לידה": s.birth_date ?? "",
          כתובת: s.address ?? "",
          "דמי חודש": s.monthly_fee ?? "",
          "איש קשר חירום - שם": s.emergency_contact_name ?? "",
          "איש קשר חירום - טלפון": s.emergency_contact_phone ?? "",
          "סוג דם": s.blood_type ?? "",
          "אישור רפואי": yn(s.health_approval),
          "תוקף אישור רפואי": s.health_approval_expiry ?? "",
          "הערות בריאות": s.health_notes ?? "",
          הערות: s.notes ?? "",
          פעיל: yn(s.active),
        })),
      },
      {
        name: "קבוצות",
        rows: (groups ?? []).map((g: any) => ({
          "שם קבוצה": g.name,
          תיאור: g.description ?? "",
          'הערות לו"ז': g.schedule_notes ?? "",
          צבע: g.color ?? "",
        })),
      },
      {
        name: "שיעורים",
        rows: (lessons ?? []).map((l: any) => ({
          תאריך: l.lesson_date,
          קבוצה: l.groups?.name ?? "",
          "שעת התחלה": l.start_time ?? "",
          "שעת סיום": l.end_time ?? "",
          מיקום: l.location ?? "",
          הערות: l.notes ?? "",
        })),
      },
      {
        name: "נוכחות",
        rows: (attendance ?? []).map((a: any) => ({
          "תאריך שיעור": a.lessons?.lesson_date ?? "",
          קבוצה: a.lessons?.groups?.name ?? "",
          חניך: a.students?.full_name ?? "",
          סטטוס: STATUS_HE[a.status] ?? a.status,
          הערות: a.notes ?? "",
        })),
      },
      {
        name: "קטגוריות תרגילים",
        rows: (categories ?? []).map((c: any) => ({
          "שם קטגוריה": c.name,
          צבע: c.color ?? "",
        })),
      },
      {
        name: "תרגילים",
        rows: (exercises ?? []).map((e: any) => ({
          "שם תרגיל": e.name,
          קטגוריה: e.exercise_categories?.name ?? "",
          תיאור: e.description ?? "",
          "משך ברירת מחדל (שנ')": e.default_duration_seconds,
          "קישור תמונה": e.image_url ?? "",
          "קישור סרטון": e.video_url ?? "",
        })),
      },
      {
        name: "תוכניות אימון",
        rows: (plans ?? []).map((p: any) => ({
          "שם תוכנית": p.name,
          תיאור: p.description ?? "",
          "הפסקת ברירת מחדל (שנ')": p.default_rest_seconds,
        })),
      },
      {
        name: "פריטי תוכנית",
        rows: (planItems ?? []).map((it: any) => ({
          תוכנית: it.workout_plans?.name ?? "",
          סדר: it.position,
          תרגיל: it.exercises?.name ?? "",
          "משך (שנ')": it.duration_seconds ?? "",
          "הפסקה אחרי (שנ')": it.rest_after_seconds ?? "",
        })),
      },
    ];
  };

  const exportAll = async () => {
    setExporting(true);
    try {
      const sheets = await buildBackupSheets();
      const wb = XLSX.utils.book_new();
      for (const sheet of sheets) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet.rows), sheet.name);
      }
      const today = new Date().toISOString().slice(0, 10);
      download(wb, `גיבוי-מאמן-${today}.xlsx`);
      toast.success("הגיבוי הורד בהצלחה");
    } catch (err: any) {
      toast.error(err.message ?? "שגיאה בייצוא");
    } finally {
      setExporting(false);
    }
  };

  const downloadTemplate = (headers: string[], filename: string, sheetName: string) => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([Object.fromEntries(headers.map((h) => [h, ""]))]);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    download(wb, filename);
  };

  const readSheet = (file: File): Promise<any[]> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          resolve(XLSX.utils.sheet_to_json(ws, { defval: "" }));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });

  const pick = (row: any, ...keys: string[]) => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== "") return row[k];
    }
    return "";
  };

  const onStudentsFile = async (file: File | null) => {
    if (!file) return;
    try {
      const rows = await readSheet(file);
      const mapped = rows
        .map((r) => ({
          full_name: str(pick(r, "שם מלא", "full_name")),
          phone: str(pick(r, "טלפון", "phone")) || null,
          email: str(pick(r, "אימייל", "email")) || null,
          id_number: str(pick(r, 'ת"ז', "id_number")) || null,
          birth_date: str(pick(r, "תאריך לידה", "birth_date")) || null,
          address: str(pick(r, "כתובת", "address")) || null,
          monthly_fee: numOrNull(pick(r, "דמי חודש", "monthly_fee")),
          emergency_contact_name:
            str(pick(r, "איש קשר חירום - שם", "emergency_contact_name")) || null,
          emergency_contact_phone:
            str(pick(r, "איש קשר חירום - טלפון", "emergency_contact_phone")) || null,
          blood_type: str(pick(r, "סוג דם", "blood_type")) || null,
          health_approval: parseYn(pick(r, "אישור רפואי", "health_approval")),
          health_approval_expiry:
            str(pick(r, "תוקף אישור רפואי", "health_approval_expiry")) || null,
          health_notes: str(pick(r, "הערות בריאות", "health_notes")) || null,
          notes: str(pick(r, "הערות", "notes")) || null,
          active: rows.length ? parseYn(pick(r, "פעיל", "active") || "כן") : true,
        }))
        .filter((r) => r.full_name);
      if (mapped.length === 0) {
        toast.error("לא נמצאו שורות עם שם מלא בקובץ");
        return;
      }
      setStudentsPreview(mapped);
    } catch {
      toast.error("שגיאה בקריאת הקובץ");
    }
  };

  const onGroupsFile = async (file: File | null) => {
    if (!file) return;
    try {
      const rows = await readSheet(file);
      const mapped = rows
        .map((r) => ({
          name: str(pick(r, "שם קבוצה", "name")),
          description: str(pick(r, "תיאור", "description")) || null,
          schedule_notes: str(pick(r, 'הערות לו"ז', "schedule_notes")) || null,
          color: str(pick(r, "צבע", "color")) || null,
        }))
        .filter((r) => r.name);
      if (mapped.length === 0) {
        toast.error("לא נמצאו שורות עם שם קבוצה בקובץ");
        return;
      }
      setGroupsPreview(mapped);
    } catch {
      toast.error("שגיאה בקריאת הקובץ");
    }
  };

  const importStudents = async () => {
    if (!studentsPreview?.length) return;
    setImportingStudents(true);
    try {
      const coach_id = await getCoachId();
      if (!coach_id) return;
      const payload = studentsPreview.map((s) => ({ ...s, coach_id }));
      const { error } = await supabase.from("students").insert(payload);
      if (error) throw error;
      toast.success(`יובאו ${payload.length} חניכים בהצלחה`);
      setStudentsPreview(null);
      if (studentsFileRef.current) studentsFileRef.current.value = "";
    } catch (err: any) {
      toast.error(err.message ?? "שגיאה בייבוא");
    } finally {
      setImportingStudents(false);
    }
  };

  const importGroups = async () => {
    if (!groupsPreview?.length) return;
    setImportingGroups(true);
    try {
      const coach_id = await getCoachId();
      if (!coach_id) return;
      const payload = groupsPreview.map((g) => ({ ...g, coach_id }));
      const { error } = await supabase.from("groups").insert(payload);
      if (error) throw error;
      toast.success(`יובאו ${payload.length} קבוצות בהצלחה`);
      setGroupsPreview(null);
      if (groupsFileRef.current) groupsFileRef.current.value = "";
    } catch (err: any) {
      toast.error(err.message ?? "שגיאה בייבוא");
    } finally {
      setImportingGroups(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">גיבוי וייבוא</h1>
        <p className="text-sm text-muted-foreground mt-1">
          ייצוא כל הנתונים לקובץ Excel (ניתן להעלות ישירות ל-Google Drive או לפתוח ב-Google Sheets),
          וייבוא חניכים או קבוצות חדשים מקובץ Excel/CSV.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CloudCog className="h-4 w-4" /> חיבור Google
          </CardTitle>
          <CardDescription>
            כל מתחבר עובד מול חשבון ה-Google האישי שלו — הגיבוי נשמר בדרייב של המשתמש המחובר, לא
            בחשבון משותף.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingGoogle ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : googleAccount ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm">
                מחובר בתור <span className="font-medium">{googleAccount.google_email}</span>
              </span>
              <Button variant="outline" size="sm" onClick={disconnectGoogle}>
                <Unlink className="h-4 w-4 ml-1" /> נתק
              </Button>
            </div>
          ) : (
            <Button onClick={connectGoogle}>
              <CloudCog className="h-4 w-4 ml-2" /> התחבר ל-Google
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="h-4 w-4" /> ייצוא גיבוי מלא
          </CardTitle>
          <CardDescription>
            כולל חניכים, קבוצות, שיעורים, נוכחות, קטגוריות תרגילים, תרגילים ותוכניות אימון — כל אחד
            בגיליון (טאב) נפרד באותו קובץ.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3 flex-wrap">
          <Button onClick={exportAll} disabled={exporting}>
            {exporting ? (
              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 ml-2" />
            )}
            הורד קובץ גיבוי (Excel)
          </Button>
          {googleAccount && (
            <Button variant="outline" onClick={exportToGoogleSheets} disabled={exportingToSheets}>
              {exportingToSheets ? (
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 ml-2" />
              )}
              ייצוא ישירות ל-Google Sheets בדרייב שלי
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-4 w-4" /> ייבוא חניכים חדשים
          </CardTitle>
          <CardDescription>
            העלה קובץ Excel/CSV עם עמודות כמו "שם מלא", "טלפון", "אימייל" וכו׳. אפשר להשתמש בקובץ
            הגיבוי שיוצא למעלה כתבנית.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={studentsFileRef}
              type="file"
              accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => onStudentsFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadTemplate(
                  ["שם מלא", "טלפון", "אימייל", 'ת"ז', "תאריך לידה", "כתובת", "דמי חודש", "הערות"],
                  "תבנית-חניכים.xlsx",
                  "חניכים",
                )
              }
            >
              <FileSpreadsheet className="h-4 w-4 ml-1" /> הורד תבנית ריקה
            </Button>
          </div>
          {studentsPreview && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                נמצאו {studentsPreview.length} חניכים לייבוא:
              </div>
              <div className="max-h-48 overflow-y-auto border rounded-md text-sm">
                {studentsPreview.map((s, i) => (
                  <div key={i} className="px-3 py-1.5 border-b last:border-0 flex justify-between">
                    <span>{s.full_name}</span>
                    <span className="text-muted-foreground">{s.phone}</span>
                  </div>
                ))}
              </div>
              <Button onClick={importStudents} disabled={importingStudents}>
                {importingStudents && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
                ייבא {studentsPreview.length} חניכים
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-4 w-4" /> ייבוא קבוצות חדשות
          </CardTitle>
          <CardDescription>
            העלה קובץ Excel/CSV עם עמודות "שם קבוצה", "תיאור", "הערות לו״ז", "צבע".
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={groupsFileRef}
              type="file"
              accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => onGroupsFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadTemplate(
                  ["שם קבוצה", "תיאור", 'הערות לו"ז', "צבע"],
                  "תבנית-קבוצות.xlsx",
                  "קבוצות",
                )
              }
            >
              <FileSpreadsheet className="h-4 w-4 ml-1" /> הורד תבנית ריקה
            </Button>
          </div>
          {groupsPreview && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                נמצאו {groupsPreview.length} קבוצות לייבוא:
              </div>
              <div className="max-h-48 overflow-y-auto border rounded-md text-sm">
                {groupsPreview.map((g, i) => (
                  <div key={i} className="px-3 py-1.5 border-b last:border-0">
                    {g.name}
                  </div>
                ))}
              </div>
              <Button onClick={importGroups} disabled={importingGroups}>
                {importingGroups && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
                ייבא {groupsPreview.length} קבוצות
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
