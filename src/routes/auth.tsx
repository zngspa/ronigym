import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Dumbbell } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
  head: () => ({ meta: [{ title: "התחברות — מאמן" }] }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error("שגיאת התחברות", { description: error.message });
    toast.success("ברוך שובך!");
    navigate({ to: "/dashboard" });
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) return toast.error("שגיאת הרשמה", { description: error.message });
    toast.success("נרשמת בהצלחה!");
    navigate({ to: "/dashboard" });
  };

  const google = async () => {
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res.error) toast.error("שגיאת Google", { description: String(res.error?.message ?? res.error) });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6 gap-3">
          <div className="h-14 w-14 rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow-lg shadow-primary/20">
            <Dumbbell className="h-7 w-7" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">מאמן</h1>
            <p className="text-sm text-muted-foreground">ניהול קבוצות, חניכים ותשלומים</p>
          </div>
        </div>

        <Card className="border-border/60 shadow-xl shadow-primary/5">
          <CardHeader className="pb-3">
            <CardTitle>ברוך הבא</CardTitle>
            <CardDescription>התחבר או צור חשבון חדש כדי להתחיל</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="signin">התחברות</TabsTrigger>
                <TabsTrigger value="signup">הרשמה</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={signIn} className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="e1">אימייל</Label>
                    <Input id="e1" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="p1">סיסמה</Label>
                    <Input id="p1" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>{loading ? "..." : "התחבר"}</Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={signUp} className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="n2">שם מלא</Label>
                    <Input id="n2" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="e2">אימייל</Label>
                    <Input id="e2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="p2">סיסמה</Label>
                    <Input id="p2" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>{loading ? "..." : "הרשמה"}</Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">או</span>
              </div>
            </div>
            <Button type="button" variant="outline" className="w-full" onClick={google}>
              המשך עם Google
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          <Link to="/dashboard">חזרה לדף הבית</Link>
        </p>
      </div>
    </div>
  );
}