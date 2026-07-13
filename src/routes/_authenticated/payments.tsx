import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/payments")({
  component: PaymentsPage,
  head: () => ({ meta: [{ title: "תשלומים — מאמן" }] }),
});

function PaymentsPage() {
  const { data: payments = [] } = useQuery({
    queryKey: ["all-payments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*, students(id, full_name, monthly_fee)")
        .order("payment_date", { ascending: false });
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    let month = 0, year = 0, all = 0;
    payments.forEach((p: any) => {
      const d = new Date(p.payment_date);
      const a = Number(p.amount);
      all += a;
      if (d >= yearStart) year += a;
      if (d >= monthStart) month += a;
    });
    return { month, year, all };
  }, [payments]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">תשלומים</h1>
        <p className="text-sm text-muted-foreground mt-1">מעקב הכנסות ותשלומי חניכים</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "החודש", value: stats.month, icon: TrendingUp, color: "bg-emerald-500/10 text-emerald-600" },
          { label: "השנה", value: stats.year, icon: Wallet, color: "bg-blue-500/10 text-blue-600" },
          { label: "סה\"כ", value: stats.all, icon: Wallet, color: "bg-violet-500/10 text-violet-600" },
        ].map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className={`h-10 w-10 rounded-lg grid place-items-center mb-2 ${c.color}`}>
                <c.icon className="h-5 w-5" />
              </div>
              <div className="text-xl md:text-2xl font-bold">₪{c.value.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{c.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">היסטוריית תשלומים</CardTitle></CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">אין תשלומים. רשום תשלום מכרטיס חניך.</p>
          ) : (
            <div className="space-y-2">
              {payments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/40">
                  <div>
                    <div className="font-medium">{p.students?.full_name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {new Date(p.payment_date).toLocaleDateString("he-IL")} · {p.method || "—"}
                      {p.notes && ` · ${p.notes}`}
                    </div>
                  </div>
                  <div className="font-bold tabular-nums">₪{Number(p.amount).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}