import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "איפוס סיסמה — מאמן" }] }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("סיסמה חייבת להיות באורך 6 תווים לפחות");
    if (password !== confirm) return toast.error("הסיסמאות אינן תואמות");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error("שגיאה", { description: error.message });
    toast.success("הסיסמה עודכנה בהצלחה");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6 gap-3">
          <div className="h-14 w-14 rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow-lg shadow-primary/20">
            <KeyRound className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">איפוס סיסמה</h1>
        </div>
        <Card className="border-border/60 shadow-xl shadow-primary/5">
          <CardHeader className="pb-3">
            <CardTitle>בחר סיסמה חדשה</CardTitle>
            <CardDescription>
              {ready ? "הזן את הסיסמה החדשה שלך" : "ממתין לאימות הקישור..."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="np">סיסמה חדשה</Label>
                <Input id="np" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} disabled={!ready} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="np2">אימות סיסמה</Label>
                <Input id="np2" type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={!ready} />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !ready}>{loading ? "..." : "עדכן סיסמה"}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}