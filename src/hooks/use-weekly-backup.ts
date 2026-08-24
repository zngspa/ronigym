import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  buildBackupSheets,
  createGoogleSpreadsheet,
  getFreshAccessToken,
  loadGoogleAccount,
} from "@/lib/backup-data";

const ENABLED_KEY = "auto_backup_weekly_enabled";
const LAST_KEY = "auto_backup_weekly_last";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function isWeeklyBackupEnabled() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ENABLED_KEY) === "1";
}

export function getLastWeeklyBackup(): Date | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(LAST_KEY);
  return raw ? new Date(raw) : null;
}

export function setWeeklyBackupEnabled(enabled: boolean) {
  localStorage.setItem(ENABLED_KEY, enabled ? "1" : "0");
}

export async function runWeeklyBackup() {
  const account = await loadGoogleAccount();
  if (!account) throw new Error("לא מחובר ל-Google");
  const token = await getFreshAccessToken(account);
  const sheets = await buildBackupSheets();
  const today = new Date().toISOString().slice(0, 10);
  const res = await createGoogleSpreadsheet(token, `גיבוי שבועי מאמן ${today}`, sheets);
  localStorage.setItem(LAST_KEY, new Date().toISOString());
  return res;
}

// Runs once per app session: if weekly auto backup is on, connected to Google
// and the last backup is older than 7 days, creates a fresh sheet in Drive.
export function useWeeklyAutoBackup() {
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isWeeklyBackupEnabled()) return;
      const last = getLastWeeklyBackup();
      if (last && Date.now() - last.getTime() < WEEK_MS) return;
      try {
        setRunning(true);
        await runWeeklyBackup();
        if (!cancelled) toast.success("גיבוי שבועי אוטומטי נשמר ב-Google Drive");
      } catch (err: any) {
        if (!cancelled) toast.error(err?.message ?? "הגיבוי השבועי האוטומטי נכשל");
      } finally {
        if (!cancelled) setRunning(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return running;
}
