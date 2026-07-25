import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { exchangeGoogleCode } from "@/lib/google-auth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/auth/google/callback")({
  component: GoogleCallbackPage,
  head: () => ({ meta: [{ title: "מתחבר ל-Google — מאמן" }] }),
});

function GoogleCallbackPage() {
  const navigate = useNavigate();
  const ran = useRef(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const errorParam = params.get("error");
      const expectedState = sessionStorage.getItem("google_oauth_state");
      sessionStorage.removeItem("google_oauth_state");

      if (errorParam) {
        toast.error("החיבור ל-Google בוטל");
        navigate({ to: "/backup" });
        return;
      }
      if (!code || !state || state !== expectedState) {
        setErrorMsg("קישור החזרה מ-Google אינו תקין. נסה להתחבר שוב.");
        return;
      }

      try {
        const result = await exchangeGoogleCode({ data: { code } });
        const { data: userRes } = await supabase.auth.getUser();
        const coach_id = userRes.user?.id;
        if (!coach_id) throw new Error("יש להתחבר לאפליקציה תחילה");

        const { data: existing } = await supabase
          .from("google_accounts")
          .select("refresh_token")
          .eq("coach_id", coach_id)
          .maybeSingle();

        const refresh_token = result.refresh_token ?? existing?.refresh_token ?? null;
        const expires_at = new Date(Date.now() + result.expires_in * 1000).toISOString();

        const { error } = await supabase.from("google_accounts").upsert({
          coach_id,
          google_email: result.email,
          access_token: result.access_token,
          refresh_token,
          scope: result.scope,
          expires_at,
        });
        if (error) throw error;

        toast.success(`התחברת בהצלחה ל-Google${result.email ? ` (${result.email})` : ""}`);
      } catch (err: any) {
        toast.error(err.message ?? "שגיאה בחיבור ל-Google");
      } finally {
        navigate({ to: "/backup" });
      }
    })();
  }, [navigate]);

  return (
    <div className="max-w-md mx-auto text-center py-24 text-muted-foreground flex flex-col items-center gap-3">
      {errorMsg ? (
        <p>{errorMsg}</p>
      ) : (
        <>
          <Loader2 className="h-6 w-6 animate-spin" />
          מתחבר ל-Google...
        </>
      )}
    </div>
  );
}
