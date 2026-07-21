import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, UsersRound, CalendarCheck, Wallet, LogOut, Dumbbell } from "lucide-react";
import { toast } from "sonner";
import type { ReactNode } from "react";

const nav = [
  { to: "/lessons", label: "שיעורים ונוכחות", icon: CalendarCheck },
  { to: "/groups", label: "קבוצות", icon: UsersRound },
  { to: "/students", label: "חניכים", icon: Users },
  { to: "/payments", label: "תשלומים", icon: Wallet },
  { to: "/dashboard", label: "לוח בקרה", icon: LayoutDashboard },
] as const;

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("התנתקת בהצלחה");
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-l border-sidebar-border">
        <div className="p-5 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center">
            <Dumbbell className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-base">מאמן</div>
            <div className="text-xs opacity-70">ניהול חניכים</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-2 space-y-1">
          {nav.map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <Button variant="ghost" onClick={signOut} className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <LogOut className="h-4 w-4 ml-2" /> התנתקות
          </Button>
        </div>
      </aside>

      {/* Mobile top bar + content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden bg-sidebar text-sidebar-foreground px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5" />
            <span className="font-bold">מאמן</span>
          </div>
          <Button size="sm" variant="ghost" onClick={signOut} className="text-sidebar-foreground">
            <LogOut className="h-4 w-4" />
          </Button>
        </header>
        <nav className="md:hidden flex overflow-x-auto gap-1 px-2 py-2 bg-card border-b">
          {nav.map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs whitespace-nowrap ${
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}