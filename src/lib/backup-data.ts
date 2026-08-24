import { supabase } from "@/integrations/supabase/client";
import { refreshGoogleToken } from "@/lib/google-auth";

const STATUS_HE: Record<string, string> = {
  present: "נוכח",
  absent: "נעדר",
  late: "איחור",
  excused: "פטור",
};

const yn = (v: boolean | null | undefined) => (v ? "כן" : "לא");

export type BackupSheet = { name: string; rows: Record<string, any>[] };

// Fetches every table and shapes it into { name, rows }[] — shared by the local
// Excel download, the direct-to-Google-Sheets export and the weekly auto backup.
export async function buildBackupSheets(): Promise<BackupSheet[]> {
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
}

export async function loadGoogleAccount() {
  const { data: userRes } = await supabase.auth.getUser();
  const coach_id = userRes.user?.id;
  if (!coach_id) return null;
  const { data } = await supabase
    .from("google_accounts")
    .select("*")
    .eq("coach_id", coach_id)
    .maybeSingle();
  return data;
}

// Returns a valid access token, refreshing it (and persisting the new one) when needed.
export async function getFreshAccessToken(googleAccount: any): Promise<string> {
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
  return refreshed.access_token;
}

// Creates a spreadsheet in the user's Drive and fills every tab.
export async function createGoogleSpreadsheet(
  accessToken: string,
  title: string,
  sheets: BackupSheet[],
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      properties: { title },
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
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      },
    );
    if (!updateRes.ok) {
      const updateErr: any = await updateRes.json();
      throw new Error(updateErr.error?.message ?? `שגיאה בכתיבת גיליון ${sheet.name}`);
    }
  }

  return { spreadsheetId: created.spreadsheetId, spreadsheetUrl: created.spreadsheetUrl };
}
